import { escapeHtml } from "../utils/emailTemplates";
import { adminAlertEmail } from "../utils/adminEmailTemplates";
import { sendMail, setMailFailureHandler } from "../utils/mailer";
import { shouldAlert } from "../utils/alertThrottle";
import { resolveUser } from "./notifications";
import Payment from "../models/Payment";
// Import de solo tipo: evita un ciclo runtime con `billing.ts`, que importa
// `notifyAdminPaymentApproved` de este archivo.
import type { ConsumeSlotResult } from "./billing";
import { IBilling } from "../models/User";

/**
 * Espejo interno de `notifications.ts`, pero con el mail del dueño como
 * único destinatario en vez del usuario del evento. Mismas reglas: todas las
 * funciones son `async` (o sync-fire-and-forget en el caso de
 * `reportCriticalError`), **nunca lanzan**, y se llaman con `void notifyAdminX(...)`
 * desde los mismos puntos donde ya se llama a `notifyX(...)`.
 *
 * Sin `ADMIN_EMAIL` configurada, todo acá es no-op — no afecta en nada al
 * envío de mails a usuarios.
 */

type BillingGateReason = Extract<ConsumeSlotResult, { ok: false }>["reason"];

const adminRecipients = (): string[] =>
  (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Usado por el handler de fallo del mailer para no reintentar alertar de una alerta fallida. */
export const isAdminRecipient = (email: string): boolean => adminRecipients().includes(email.trim());

const sendAdminAlert = async (content: Parameters<typeof adminAlertEmail>[0]): Promise<void> => {
  const recipients = adminRecipients();
  if (recipients.length === 0) return;

  const mail = adminAlertEmail(content);
  try {
    await Promise.all(recipients.map((to) => sendMail({ to, ...mail })));
  } catch (error) {
    // No debería llegar acá: `sendMail` ya atrapa sus propios errores. Es una
    // red de más por si algún día `sendAdminAlert` gana lógica que sí pueda
    // lanzar — nunca debe tumbar el flujo de negocio que dispara la alerta.
    console.error("[adminAlerts] Error inesperado enviando alerta interna:", error);
  }
};

const formatAmount = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};

// ---------------------------------------------------------------------------
// Pago acreditado.
// ---------------------------------------------------------------------------

export const notifyAdminPaymentApproved = async (params: {
  userId: string;
  subscriptionId: string;
  plan: string;
  interval: string;
  amount: number;
  currency: string;
  currentPeriodEnd: Date | null;
}): Promise<void> => {
  const [user, chargeCount] = await Promise.all([
    resolveUser(params.userId),
    Payment.countDocuments({ subscriptionId: params.subscriptionId, status: "approved" })
  ]);
  if (!user) return;

  const isFirstCharge = chargeCount <= 1;
  const safeUsername = escapeHtml(user.username);
  const safePlan = escapeHtml(params.plan);

  await sendAdminAlert({
    eyebrow: "Pago",
    accent: "gold",
    title: isFirstCharge ? "Nueva suscripción pagada" : "Renovación cobrada",
    summaryText:
      `${user.username} (${user.email}) ${isFirstCharge ? "se suscribió al" : "renovó el"} plan ${params.plan} ` +
      `por ${formatAmount(params.amount, params.currency)}.`,
    summaryHtml:
      `<strong>${safeUsername}</strong> (${escapeHtml(user.email)}) ` +
      `${isFirstCharge ? "se suscribió al" : "renovó el"} plan <strong>${safePlan}</strong>.`,
    rows: [
      { label: "Monto", value: escapeHtml(formatAmount(params.amount, params.currency)) },
      { label: "Intervalo", value: escapeHtml(params.interval) },
      { label: "Tipo", value: isFirstCharge ? "Alta nueva" : "Renovación" },
      ...(params.currentPeriodEnd
        ? [{ label: "Vence el", value: escapeHtml(params.currentPeriodEnd.toLocaleDateString("es-AR")) }]
        : [])
    ]
  });
};

// ---------------------------------------------------------------------------
// Límite de plan alcanzado — la señal comercial más directa: sabés a quién
// contactar y por qué. Throttle de 24h por usuario+motivo para no repetir el
// mismo aviso cada vez que alguien reintenta la acción bloqueada.
// ---------------------------------------------------------------------------

const GATE_REASON_LABEL: Record<BillingGateReason, string> = {
  no_free_slot: "Gastó su torneo gratuito (candidato a primera venta)",
  monthly_limit_reached: "Tocó el límite mensual de su plan pago (candidato a upgrade)",
  no_subscription: "Su plan venció y sigue intentando crear torneos (recuperable)"
};

export const notifyAdminPlanLimitHit = async (params: {
  userId: string;
  reason: BillingGateReason;
  plan: string;
  usage: IBilling["usage"];
}): Promise<void> => {
  if (!shouldAlert(`limit:${params.userId}:${params.reason}`, 24 * 60 * 60 * 1000)) return;

  const user = await resolveUser(params.userId);
  if (!user) return;

  const safeUsername = escapeHtml(user.username);
  const safePlan = escapeHtml(params.plan);
  const label = GATE_REASON_LABEL[params.reason];

  await sendAdminAlert({
    eyebrow: "Plan",
    accent: "blue",
    title: "Usuario tocó el límite de su plan",
    summaryText: `${user.username} (${user.email}) — plan ${params.plan}. ${label}.`,
    summaryHtml: `<strong>${safeUsername}</strong> (${escapeHtml(user.email)}) — plan <strong>${safePlan}</strong>.`,
    rows: [
      { label: "Motivo", value: escapeHtml(label) },
      { label: "Torneos este mes", value: String(params.usage.tournamentsCreated ?? 0) },
      { label: "Torneos totales", value: String(params.usage.tournamentsTotal ?? 0) }
    ]
  });
};

// ---------------------------------------------------------------------------
// Cupo de jugadores por liga alcanzado — misma idea que el límite de
// torneos, pero con su propio shape (no hay "usage" de torneos acá). No
// reusa `notifyAdminPlanLimitHit` porque `IBilling["usage"]` no tiene ni
// remotamente los campos que importan en este motivo (jugadores actuales /
// cupo del plan, no torneos del mes).
// ---------------------------------------------------------------------------

export const notifyAdminLeagueCapHit = async (params: {
  ownerId: string;
  plan: string;
  current: number;
  limit: number;
}): Promise<void> => {
  if (!shouldAlert(`limit:${params.ownerId}:league_member_limit_reached`, 24 * 60 * 60 * 1000)) return;

  const user = await resolveUser(params.ownerId);
  if (!user) return;

  const safeUsername = escapeHtml(user.username);
  const safePlan = escapeHtml(params.plan);
  const label = "Tocó el cupo de jugadores por liga de su plan (candidato a upgrade)";

  await sendAdminAlert({
    eyebrow: "Plan",
    accent: "blue",
    title: "Usuario tocó el cupo de jugadores de su liga",
    summaryText: `${user.username} (${user.email}) — plan ${params.plan}. ${label}.`,
    summaryHtml: `<strong>${safeUsername}</strong> (${escapeHtml(user.email)}) — plan <strong>${safePlan}</strong>.`,
    rows: [
      { label: "Motivo", value: escapeHtml(label) },
      { label: "Jugadores actuales", value: String(params.current) },
      { label: "Cupo del plan", value: String(params.limit) }
    ]
  });
};

// ---------------------------------------------------------------------------
// Errores críticos. Sync por fuera (dispara el envío async por dentro) para
// poder llamarse cómodo desde un `catch` sin awaitear. Throttle por `key`
// para que un fallo en loop no inunde la casilla.
// ---------------------------------------------------------------------------

const errorDetail = (error: unknown): string => {
  if (error instanceof Error) {
    const stackLines = (error.stack ?? "").split("\n").slice(0, 10).join("\n");
    return stackLines || error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const reportCriticalError = (
  key: string,
  title: string,
  error: unknown,
  context?: Record<string, string>
): void => {
  if (!shouldAlert(`error:${key}`, 15 * 60 * 1000)) return;

  const detail = errorDetail(error);
  const contextText = context
    ? Object.entries(context)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  void sendAdminAlert({
    eyebrow: "Error",
    accent: "red",
    title,
    summaryText: `${title}.${contextText ? `\n${contextText}` : ""}`,
    summaryHtml: `Se produjo un error: <strong>${escapeHtml(title)}</strong>.`,
    rows: context
      ? Object.entries(context).map(([label, value]) => ({ label: escapeHtml(label), value: escapeHtml(value) }))
      : undefined,
    noticeHtml: `<pre style="margin:0;white-space:pre-wrap;font-family:monospace;font-size:12px;">${escapeHtml(detail)}</pre>`
  });
};

// Registro del handler de fallo del mailer. Se hace acá (en vez de en
// `mailer.ts`, que no puede importar este módulo sin cerrar un ciclo) y se
// garantiza al arrancar el proceso importando este archivo desde `index.ts`.
// Si el destinatario que falló es justamente un admin, se descarta en vez de
// alertar: evita el loop de "la alerta de que la alerta falló, falló".
setMailFailureHandler((to, subject, error) => {
  if (isAdminRecipient(to)) return;
  reportCriticalError(`mailer:send:${to}`, "No se pudo enviar un mail", error, { destinatario: to, asunto: subject });
});
