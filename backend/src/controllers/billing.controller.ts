import { Request, Response } from "express";
import {
  getUsage,
  UsageSummary,
  findActiveProviderSubscription,
  createPendingProviderSubscription,
  setSubscriptionExternalId,
  updateSubscriptionMandateStatus,
  applyProviderSubscriptionCharge,
  markSubscriptionPastDue,
  reconcileProviderSubscription,
  reconcileStalePendingSubscriptions,
  findUsersNeedingExpiryReminder,
  markExpiryReminderSent
} from "../services/billing";
import { getUsdToArs } from "../services/pricing";
import User from "../models/User";
import Subscription from "../models/Subscription";
import Payment from "../models/Payment";
import {
  PLANS,
  PLAN_IDS,
  PLAN_CATALOG,
  isValidPlanId,
  monthsForInterval,
  priceArsFor,
  SubscriptionInterval
} from "../config/plans";
import {
  isMercadoPagoEnabled,
  createPreapproval,
  getPreapproval,
  getAuthorizedPayment,
  updatePreapprovalStatus,
  verifyWebhookSignature,
  MercadoPagoError
} from "../services/mercadopago";
import {
  notifyPaymentApproved,
  notifyPaymentRejected,
  notifySubscriptionCanceled,
  notifyExpiryReminders
} from "../services/notifications";

interface AuthRequest extends Request {
  user?: string;
}

const isValidInterval = (value: unknown): value is SubscriptionInterval =>
  value === "monthly" || value === "quarterly" || value === "yearly";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INTERVAL_LABEL: Record<SubscriptionInterval, string> = {
  monthly: "mensual",
  quarterly: "trimestral",
  yearly: "anual"
};

/**
 * `JSON.stringify` convierte `Infinity` en `null` en silencio — acá lo
 * hacemos explícito para que el frontend sepa que `null` en un límite
 * significa "sin tope" y no "dato faltante".
 */
const nullifyInfinity = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, value === Infinity ? null : value]));

const serializeUsage = (usage: UsageSummary) => ({
  ...usage,
  limits: nullifyInfinity(usage.limits)
});

/** El propio usuario consulta su plan, uso del período y vencimiento. */
export const getMyBilling = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usage = await getUsage(req.user!);
    res.status(200).json(serializeUsage(usage));
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener el estado de tu plan", error: error.message });
  }
};

/**
 * Reconciliación de respaldo: el frontend la llama al volver del checkout de
 * MercadoPago (`?mp=return`), por si el webhook todavía no llegó (o nunca
 * llega, como puede pasar en sandbox). Consulta el estado real en MP y
 * aplica exactamente lo mismo que aplicarían los webhooks.
 */
export const syncMySubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (isMercadoPagoEnabled()) {
      await reconcileProviderSubscription(req.user!);
    }
    const usage = await getUsage(req.user!);
    res.status(200).json(serializeUsage(usage));
  } catch (error: any) {
    res.status(500).json({ message: "Error al sincronizar tu suscripción", error: error.message });
  }
};

/**
 * Tipo de cambio USD → ARS vigente y catálogo completo de planes (nombre,
 * precios y límites), para la grilla de precios y el checkout. Público a
 * propósito: `/planes` es visible sin login.
 */
export const getPricing = async (_req: Request, res: Response): Promise<void> => {
  try {
    const usdToArs = await getUsdToArs();
    const plans = PLAN_IDS.map((id) => {
      const catalog = PLAN_CATALOG[id];
      return {
        id,
        label: catalog.label,
        priceUsdMonthly: catalog.priceUsdMonthly,
        priceUsdYearly: catalog.priceUsdYearly,
        priceArsMonthly: priceArsFor(id, "monthly", usdToArs),
        priceArsYearly: priceArsFor(id, "yearly", usdToArs),
        highlight: catalog.highlight ?? false,
        limits: nullifyInfinity(PLANS[id])
      };
    });
    res.status(200).json({ usdToArs, mercadoPagoEnabled: isMercadoPagoEnabled(), plans });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener los precios", error: error.message });
  }
};

/** Historial propio de suscripciones y pagos, para que el usuario vea qué contrató y cuándo pagó. */
export const getMyBillingHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [subscriptions, payments] = await Promise.all([
      Subscription.find({ userId: req.user! }).sort({ createdAt: -1 }),
      // Sin `rawPayload` (respuesta cruda de MP, no es para el cliente) ni
      // `createdBy` (id interno de quién acreditó un alta manual).
      Payment.find({ userId: req.user! }).select("-rawPayload -createdBy").sort({ createdAt: -1 })
    ]);
    res.status(200).json({ subscriptions, payments });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener tu historial", error: error.message });
  }
};

/**
 * Inicia el checkout de un plan pago: crea la suscripción local en `pending`
 * y un preapproval de MercadoPago "con pago pendiente" (sin token de
 * tarjeta), devolviendo el `init_point` al que el frontend redirige. El
 * monto se calcula acá — nunca se acepta un `amount` del cliente.
 */
export const createCheckout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan, interval, payerEmail } = req.body as { plan?: string; interval?: string; payerEmail?: string };

    if (!isValidPlanId(plan) || plan === "free") {
      return void res.status(400).json({
        message: `Plan inválido (${PLAN_IDS.filter((p) => p !== "free").join(" | ")})`
      });
    }
    if (!isValidInterval(interval)) {
      return void res.status(400).json({ message: "Intervalo inválido (monthly | quarterly | yearly)" });
    }
    if (payerEmail !== undefined && !EMAIL_REGEX.test(payerEmail)) {
      return void res.status(400).json({ message: "El email de MercadoPago no es válido" });
    }
    if (!isMercadoPagoEnabled()) {
      return void res.status(409).json({
        message: "El cobro automático todavía no está disponible.",
        fallback: "manual"
      });
    }

    const user = await User.findById(req.user!).select("email");
    if (!user) return void res.status(404).json({ message: "Usuario no encontrado" });

    const usdToArs = await getUsdToArs();
    const amount = priceArsFor(plan, interval, usdToArs);
    if (amount === null) {
      return void res.status(400).json({ message: "Este plan no tiene precio configurado" });
    }

    // Cambio de plan = nueva suscripción: cancelamos cualquier preapproval en
    // curso primero para no terminar con dos mandatos cobrando en paralelo.
    const existing = await findActiveProviderSubscription(req.user!);
    if (existing?.externalId) {
      try {
        await updatePreapprovalStatus(existing.externalId, "cancelled");
      } catch {
        // Si ya estaba cancelada del lado de MP (p.ej. el usuario la cortó
        // desde su propia cuenta), no hay nada que reintentar acá: lo que
        // importa es que localmente ya no cuente como activa.
      }
      await updateSubscriptionMandateStatus({ externalId: existing.externalId, mpStatus: "cancelled" });
    }

    const subscription = await createPendingProviderSubscription({ userId: req.user!, plan, interval });

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    let preapproval;
    try {
      preapproval = await createPreapproval({
        reason: `TrickApp — Plan ${PLAN_CATALOG[plan].label} (${INTERVAL_LABEL[interval]})`,
        externalReference: String(subscription._id),
        // El usuario puede confirmar en el checkout un email de MercadoPago
        // distinto al de su cuenta de TrickApp (ver Plans.tsx) — MP exige que
        // coincida exactamente con el de la cuenta con la que va a pagar.
        payerEmail: payerEmail ?? user.email,
        backUrl: `${frontendUrl}/profile?tab=plan&mp=return`,
        frequency: monthsForInterval(interval),
        transactionAmount: amount
      });
    } catch (err) {
      // No dejamos una suscripción `pending` huérfana si MP nunca llegó a crearla.
      await Subscription.deleteOne({ _id: subscription._id });
      throw err;
    }

    await setSubscriptionExternalId(String(subscription._id), preapproval.id);

    res.status(200).json({ initPoint: preapproval.init_point });
  } catch (error: any) {
    res.status(500).json({ message: "Error al iniciar el pago", error: error.message });
  }
};

/**
 * Webhook de MercadoPago. Público (MP no manda `Authorization`); la firma
 * `x-signature` es la única barrera de entrada — se valida antes de tocar
 * cualquier dato. Responde 200 siempre que el evento se haya procesado (o
 * detectado como duplicado): cualquier otra cosa hace que MP reintente.
 */
export const mercadoPagoWebhook = async (req: Request, res: Response): Promise<void> => {
  const type = (req.query.type as string | undefined) ?? (req.body?.type as string | undefined);
  const dataId =
    (req.query["data.id"] as string | undefined) ?? (req.body?.data?.id as string | undefined);

  // Sin esta traza no hay forma de distinguir "MP nunca notificó" de "MP
  // notificó y lo rechazamos/ignoramos": las tres situaciones se ven idénticas
  // desde afuera, porque el endpoint responde 200 tanto cuando acredita un
  // cobro como cuando descarta un evento que no le corresponde.
  console.log(`[webhook:mp] evento recibido — type=${type ?? "(sin type)"} data.id=${dataId ?? "(sin id)"}`);

  try {
    const signatureOk = verifyWebhookSignature({
      xSignature: req.header("x-signature"),
      xRequestId: req.header("x-request-id"),
      dataId
    });
    if (!signatureOk) {
      // Casi siempre es `MP_WEBHOOK_SECRET` desincronizado con el panel de MP
      // (o la clave de otra aplicación). Sin este log, el rechazo es mudo.
      console.warn(`[webhook:mp] firma inválida — type=${type} data.id=${dataId}`);
      res.status(401).json({ message: "Firma inválida" });
      return;
    }

    if (type === "subscription_preapproval") {
      const preapproval = await getPreapproval(dataId!);
      await updateSubscriptionMandateStatus({ externalId: preapproval.id, mpStatus: preapproval.status });
    } else if (type === "subscription_authorized_payment") {
      const authorizedPayment = await getAuthorizedPayment(dataId!);
      const subscription = await Subscription.findOne({
        paymentProvider: "mercadopago",
        externalId: authorizedPayment.preapproval_id
      });
      if (subscription) {
        if (authorizedPayment.payment?.status === "approved") {
          const result = await applyProviderSubscriptionCharge({
            subscriptionId: String(subscription._id),
            amount: authorizedPayment.transaction_amount,
            externalId: String(authorizedPayment.id)
          });
          // MP reintenta webhooks: en un reintento `result` es `{ duplicate: true }`
          // y no hay que volver a avisar un cobro que el usuario ya recibió.
          if ("subscription" in result) {
            void notifyPaymentApproved(
              String(result.subscription.userId),
              result.subscription.plan,
              result.subscription.currentPeriodEnd ?? null
            );
          }
        } else if (authorizedPayment.payment?.status === "rejected") {
          await markSubscriptionPastDue(String(subscription.userId));
          void notifyPaymentRejected(String(subscription.userId), subscription.plan);
        }
      }
    }
    // Otros tipos (`payment`, `subscription_preapproval_plan`) no aplican a este flujo.

    res.status(200).json({ received: true });
  } catch (error: any) {
    // MP reintenta ante cualquier respuesta que no sea 2xx. Si el recurso no
    // existe (404), ningún reintento va a prosperar: cerramos el evento con
    // 200 para no quedar recibiendo la misma notificación imposible. Es
    // también lo que manda el botón "Simular notificación" del panel, que usa
    // ids ficticios (`data.id: "123456"`) que no corresponden a ningún
    // preapproval real.
    if (error instanceof MercadoPagoError && error.status === 404) {
      console.warn(`[webhook:mp] recurso inexistente en MP — type=${type} data.id=${dataId}. Evento descartado.`);
      res.status(200).json({ received: true, ignored: "not_found" });
      return;
    }

    // El resto sí puede ser transitorio (MP caído, timeout, Mongo): devolvemos
    // 500 a propósito para que MP reintente.
    console.error(`[webhook:mp] error procesando el evento — type=${type} data.id=${dataId}:`, error);
    res.status(500).json({ message: "Error al procesar el webhook", error: error.message });
  }
};

/**
 * Barrido periódico. Hace dos cosas independientes en la misma corrida
 * (mismo disparador externo, no hay scheduler propio — ver el comentario de
 * `reconcileStalePendingSubscriptions`):
 *  1. Reconcilia suscripciones `pending` que quedaron huérfanas (el usuario
 *     pagó pero nunca volvió a `?mp=return`, y el webhook de MP no llegó).
 *  2. Manda el recordatorio de vencimiento próximo a quien le toque. Esto NO
 *     depende de MercadoPago: un alta manual (`grantSubscriptionPeriod`)
 *     también vence y también necesita el aviso.
 * No para un usuario logueado — por eso el secreto compartido en vez de JWT.
 */
export const reconcilePendingSubscriptionsCron = async (req: Request, res: Response): Promise<void> => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.header("x-cron-secret") !== secret) {
      return void res.status(401).json({ message: "No autorizado" });
    }

    const result = isMercadoPagoEnabled()
      ? await reconcileStalePendingSubscriptions()
      : { checked: 0, users: [] as string[] };

    const candidates = await findUsersNeedingExpiryReminder();
    const remindersSent = await notifyExpiryReminders(candidates);
    await Promise.all(candidates.map((c) => markExpiryReminderSent(c.userId, c.currentPeriodEnd)));

    res.status(200).json({ ...result, remindersSent });
  } catch (error: any) {
    res.status(500).json({ message: "Error al reconciliar suscripciones pendientes", error: error.message });
  }
};

/**
 * El usuario corta su propia renovación automática. El acceso ya pagado
 * sigue corriendo hasta `currentPeriodEnd` — esto solo evita el próximo cobro.
 */
export const cancelMySubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subscription = await findActiveProviderSubscription(req.user!);
    if (!subscription || !subscription.externalId) {
      return void res.status(404).json({ message: "No tenés una suscripción con débito automático activa" });
    }

    await updatePreapprovalStatus(subscription.externalId, "cancelled");
    await updateSubscriptionMandateStatus({ externalId: subscription.externalId, mpStatus: "cancelled" });

    void notifySubscriptionCanceled(req.user!, subscription.plan, subscription.currentPeriodEnd ?? null);

    res.status(200).json({
      message: "Cancelaste la renovación automática. Tu plan sigue activo hasta el vencimiento."
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al cancelar la suscripción", error: error.message });
  }
};
