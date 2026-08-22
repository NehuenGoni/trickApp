import User, { INotificationPrefs } from "../models/User";
import { MailContent, MailPayload, sendMail, sendMailBatch } from "../utils/mailer";
import {
  emailVerificationEmail,
  matchResultEmail,
  organizerAddedEmail,
  paymentApprovedEmail,
  paymentRejectedEmail,
  expiryReminderEmail,
  subscriptionCanceledEmail,
  subscriptionGrantedEmail,
  tournamentClosedEmail,
  tournamentSignupConfirmedEmail,
  tournamentStartedEmail
} from "../utils/emailTemplates";
import { signUnsubscribeToken, UnsubscribablePref } from "../utils/unsubscribeToken";

/**
 * Capa entre los controllers y `mailer.ts`. Existe porque casi ningún punto
 * de enganche real tiene el email a mano (el webhook de MercadoPago solo
 * trae `subscription.userId`, `awardTournamentPoints` solo maneja ObjectIds,
 * etc.): acá se resuelve el destinatario, se filtra por preferencias, se
 * arma el link de baja y se elige envío simple vs. batch.
 *
 * Todas las funciones exportadas son `async` y **nunca lanzan** — igual que
 * `sendMail`/`sendMailBatch` — para que un fallo de notificación jamás
 * interrumpa el flujo de negocio que la dispara. Se llaman fire-and-forget
 * (`void notifyX(...)`) desde los controllers, nunca dentro de un
 * `withTransaction`.
 */

export interface NotifiableUser {
  _id: unknown;
  email: string;
  username: string;
  notificationPrefs?: INotificationPrefs;
}

const frontendBase = (): string =>
  (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const buildUrl = (path: string): string => `${frontendBase()}${path}`;

const buildUnsubscribeUrl = (userId: unknown, pref: UnsubscribablePref): string =>
  buildUrl(`/unsubscribe/${signUnsubscribeToken(String(userId), pref)}`);

/** Trae `{ email, username, notificationPrefs }` de un solo usuario a partir de su id. */
export const resolveUser = async (userId: string): Promise<NotifiableUser | null> => {
  try {
    return await User.findById(userId).select("email username notificationPrefs").lean();
  } catch (error) {
    console.error(`[notifications] Error resolviendo usuario ${userId}:`, error);
    return null;
  }
};

/** Trae `{ email, username, notificationPrefs }` de varios usuarios a partir de sus ids. */
export const resolveUsers = async (userIds: unknown[]): Promise<NotifiableUser[]> => {
  if (userIds.length === 0) return [];
  try {
    return await User.find({ _id: { $in: userIds } })
      .select("email username notificationPrefs")
      .lean();
  } catch (error) {
    console.error("[notifications] Error resolviendo usuarios:", error);
    return [];
  }
};

/**
 * Despacha un mail a varios usuarios ya resueltos, filtrando por la
 * preferencia indicada (`prefKey: null` = transaccional, se manda siempre).
 * Usa `sendMail` para un solo destinatario y `sendMailBatch` para más de uno.
 */
const dispatch = async (
  recipients: NotifiableUser[],
  prefKey: UnsubscribablePref | null,
  buildContent: (user: NotifiableUser, unsubscribeUrl: string) => MailContent
): Promise<number> => {
  const targets = prefKey
    ? recipients.filter((u) => u.notificationPrefs?.[prefKey] !== false)
    : recipients;

  if (targets.length === 0) return 0;

  const payloads: MailPayload[] = targets.map((u) => {
    const unsubscribeUrl = prefKey ? buildUnsubscribeUrl(u._id, prefKey) : "";
    return { to: u.email, ...buildContent(u, unsubscribeUrl) };
  });

  if (payloads.length === 1) {
    return (await sendMail(payloads[0])) ? 1 : 0;
  }
  return sendMailBatch(payloads);
};

// ---------------------------------------------------------------------------
// Verificación de cuenta (Fase 1) — transaccional, siempre se manda.
// ---------------------------------------------------------------------------

export const notifyEmailVerification = async (
  user: { email: string; username: string },
  rawToken: string
): Promise<void> => {
  const url = buildUrl(`/verify-email/${rawToken}`);
  await sendMail({ to: user.email, ...emailVerificationEmail(user.username, url, 48) });
};

// ---------------------------------------------------------------------------
// Billing (Fase 2) — transaccional, siempre se manda: no hay preferencia de
// opt-out para pagos, solo para torneos/ligas.
// ---------------------------------------------------------------------------

export const notifyPaymentApproved = async (
  userId: string,
  plan: string,
  currentPeriodEnd: Date | null
): Promise<void> => {
  const user = await resolveUser(userId);
  if (!user) return;
  await sendMail({ to: user.email, ...paymentApprovedEmail(user.username, plan, currentPeriodEnd) });
};

export const notifyPaymentRejected = async (userId: string, plan: string): Promise<void> => {
  const user = await resolveUser(userId);
  if (!user) return;
  const billingUrl = buildUrl("/profile?tab=plan");
  await sendMail({ to: user.email, ...paymentRejectedEmail(user.username, plan, billingUrl) });
};

export const notifySubscriptionCanceled = async (
  userId: string,
  plan: string,
  currentPeriodEnd: Date | null
): Promise<void> => {
  const user = await resolveUser(userId);
  if (!user) return;
  await sendMail({ to: user.email, ...subscriptionCanceledEmail(user.username, plan, currentPeriodEnd) });
};

export const notifySubscriptionGranted = async (
  user: { email: string; username: string },
  plan: string,
  currentPeriodEnd: Date | null
): Promise<void> => {
  await sendMail({ to: user.email, ...subscriptionGrantedEmail(user.username, plan, currentPeriodEnd) });
};

/** Recordatorio de vencimiento próximo, disparado desde el cron de reconcile-pending. */
export const notifyExpiryReminders = async (
  entries: Array<{ userId: string; username: string; email: string; plan: string; currentPeriodEnd: Date }>
): Promise<number> => {
  if (entries.length === 0) return 0;
  const billingUrl = buildUrl("/profile?tab=plan");
  const payloads: MailPayload[] = entries.map((e) => ({
    to: e.email,
    ...expiryReminderEmail(e.username, e.plan, e.currentPeriodEnd, billingUrl)
  }));
  if (payloads.length === 1) return (await sendMail(payloads[0])) ? 1 : 0;
  return sendMailBatch(payloads);
};

// ---------------------------------------------------------------------------
// Ligas (Fase 3.5)
// ---------------------------------------------------------------------------

export const notifyOrganizerAdded = async (
  user: { _id: unknown; email: string; username: string },
  leagueName: string,
  leagueId: string
): Promise<void> => {
  const leagueUrl = buildUrl(`/leagues/${leagueId}`);
  await sendMail({ to: user.email, ...organizerAddedEmail(user.username, leagueName, leagueUrl) });
};

// ---------------------------------------------------------------------------
// Torneos (Fase 3.1 - 3.4)
// ---------------------------------------------------------------------------

export const notifyTournamentSignup = async (
  recipients: NotifiableUser[],
  tournamentName: string,
  tournamentId: string
): Promise<number> => {
  const tournamentUrl = buildUrl(`/tournaments/${tournamentId}`);
  return dispatch(recipients, "tournamentSignup", (user, unsubscribeUrl) =>
    tournamentSignupConfirmedEmail(user.username, tournamentName, tournamentUrl, unsubscribeUrl)
  );
};

export interface TournamentStartedEntry {
  user: NotifiableUser;
  teammates: string[];
  opponent: string | null;
}

export const notifyTournamentStarted = async (
  entries: TournamentStartedEntry[],
  tournamentName: string,
  tournamentId: string
): Promise<number> => {
  const tournamentUrl = buildUrl(`/tournaments/${tournamentId}`);
  const targets = entries.filter((e) => e.user.notificationPrefs?.tournamentStart !== false);
  if (targets.length === 0) return 0;

  const payloads: MailPayload[] = targets.map(({ user, teammates, opponent }) => ({
    to: user.email,
    ...tournamentStartedEmail(
      user.username,
      tournamentName,
      teammates,
      opponent,
      tournamentUrl,
      buildUnsubscribeUrl(user._id, "tournamentStart")
    )
  }));

  if (payloads.length === 1) return (await sendMail(payloads[0])) ? 1 : 0;
  return sendMailBatch(payloads);
};

export interface MatchResultEntry {
  user: NotifiableUser;
  won: boolean;
  nextPhaseLabel: string | null;
  finalPosition: number | null;
}

export const notifyMatchResults = async (
  entries: MatchResultEntry[],
  tournamentName: string,
  tournamentId: string
): Promise<number> => {
  const tournamentUrl = buildUrl(`/tournaments/${tournamentId}`);
  const targets = entries.filter((e) => e.user.notificationPrefs?.matchResults === true);
  if (targets.length === 0) return 0;

  const payloads: MailPayload[] = targets.map(({ user, won, nextPhaseLabel, finalPosition }) => ({
    to: user.email,
    ...matchResultEmail(
      user.username,
      tournamentName,
      won,
      nextPhaseLabel,
      finalPosition,
      tournamentUrl,
      buildUnsubscribeUrl(user._id, "matchResults")
    )
  }));

  if (payloads.length === 1) return (await sendMail(payloads[0])) ? 1 : 0;
  return sendMailBatch(payloads);
};

export interface TournamentClosedEntry {
  user: NotifiableUser;
  position: number;
  points: number;
}

export const notifyTournamentClosed = async (
  entries: TournamentClosedEntry[],
  tournamentName: string,
  tournamentId: string
): Promise<number> => {
  const tournamentUrl = buildUrl(`/tournaments/${tournamentId}`);
  const targets = entries.filter((e) => e.user.notificationPrefs?.tournamentResults !== false);
  if (targets.length === 0) return 0;

  const payloads: MailPayload[] = targets.map(({ user, position, points }) => ({
    to: user.email,
    ...tournamentClosedEmail(
      user.username,
      tournamentName,
      position,
      points,
      tournamentUrl,
      buildUnsubscribeUrl(user._id, "tournamentResults")
    )
  }));

  if (payloads.length === 1) return (await sendMail(payloads[0])) ? 1 : 0;
  return sendMailBatch(payloads);
};
