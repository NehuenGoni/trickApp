import crypto from "crypto";

/** Genera un token opaco para links de un solo uso (reset de contraseña, verificación de email). */
export const generateToken = (): string => crypto.randomBytes(32).toString("hex");

/**
 * Se guarda el hash del token en la base, nunca el valor que viaja al mail:
 * si alguien lee la base no puede reconstruir el enlace.
 */
export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");
