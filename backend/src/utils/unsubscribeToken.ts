import crypto from "crypto";

/**
 * Preferencias de notificación que se pueden dar de baja desde el link de un
 * mail (ver `INotificationPrefs` en `models/User.ts`). Los transaccionales
 * (verificación, pagos) no tienen entrada acá: siempre se mandan.
 */
export type UnsubscribablePref =
  | "tournamentSignup"
  | "tournamentStart"
  | "tournamentResults"
  | "matchResults"
  | "leagueRoles";

/**
 * Si no se configuró `UNSUBSCRIBE_SECRET`, se deriva uno de `JWT_SECRET` en
 * vez de reusarlo directo: así un token de unsubscribe filtrado no sirve para
 * forjar nada relacionado a sesiones, y el link de baja funciona out-of-the-box
 * en desarrollo sin pedir una variable de entorno más.
 */
const getSecret = (): string =>
  process.env.UNSUBSCRIBE_SECRET ||
  crypto.createHash("sha256").update(`unsubscribe:${process.env.JWT_SECRET || "dev"}`).digest("hex");

const sign = (payload: string): string =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");

/** Token de un solo propósito (sin expiración: es una baja, no un secreto de acceso). */
export const signUnsubscribeToken = (userId: string, pref: UnsubscribablePref): string => {
  const payload = `${userId}.${pref}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
};

export const verifyUnsubscribeToken = (
  token: string
): { userId: string; pref: UnsubscribablePref } | null => {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [userId, pref, sig] = decoded.split(".");
    if (!userId || !pref || !sig) return null;

    const expected = sign(`${userId}.${pref}`);
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    return { userId, pref: pref as UnsubscribablePref };
  } catch {
    return null;
  }
};
