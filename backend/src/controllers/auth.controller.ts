import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import dotenv from "dotenv";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_TTL_MINUTES,
  EMAIL_VERIFICATION_TTL_HOURS
} from "../config/constants";
import { sendMail, isMailConfigured } from "../utils/mailer";
import { passwordResetEmail, passwordChangedEmail } from "../utils/emailTemplates";
import { notifyEmailVerification } from "../services/notifications";
import { createRateLimiter } from "../utils/rateLimiter";
import { generateToken, hashToken } from "../utils/tokens";
import { verifyUnsubscribeToken } from "../utils/unsubscribeToken";

dotenv.config();

interface AuthRequest extends Request {
  user?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Máximo 3 pedidos de recuperación por email cada 15 minutos. */
const forgotPasswordLimiter = createRateLimiter(3, 15 * 60 * 1000);

/** Máximo 3 reenvíos del mail de verificación por email cada 15 minutos. */
const resendVerificationLimiter = createRateLimiter(3, 15 * 60 * 1000);

const buildResetUrl = (token: string): string => {
  const base = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/reset-password/${token}`;
};

/** Busca el usuario dueño de un token de recuperación vigente. */
const findUserByResetToken = async (token: string) =>
  User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() }
  }).select("+passwordResetToken +passwordResetExpires");

/** Busca el usuario dueño de un token de verificación de email vigente. */
const findUserByVerificationToken = async (token: string) =>
  User.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() }
  }).select("+emailVerificationToken +emailVerificationExpires");

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;
      // Normalizado a lowercase, igual que en `forgotPassword`: sin esto, "User@x.com"
      // y "user@x.com" quedarían como cuentas distintas para el login pero la misma
      // para el índice único de Mongo, dando un 500 confuso en vez de un 400 claro.
      const email = (req.body?.email as string | undefined)?.trim().toLowerCase();

      const userExists = await User.findOne({ email });
      if (userExists) {
        res.status(400).json({ message: "Usuario ya existe" });
        return;
      }

      const rawToken = generateToken();
      const newUser = new User({
        username,
        email,
        password,
        emailVerificationToken: hashToken(rawToken),
        emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000)
      });

      await newUser.save();

      // Fire-and-forget: un fallo de envío no debe impedir que la cuenta se cree.
      void notifyEmailVerification({ email: newUser.email, username: newUser.username }, rawToken);

      res.status(201).json({
        message: "Usuario registrado con éxito",
        user: {
          _id: newUser._id,
          username: newUser.username,
          email: newUser.email
        }
      });
    } catch (err) {
      res.status(500).json({ message: "Error al registrar el usuario", error: err });
    }
  };
 

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      res.status(400).json({ message: "Usuario no encontrado" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      res.status(400).json({ message: "Contraseña incorrecta" });
      return;
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: "60d" });

    res.status(200).json({ message: "Login exitoso", token, userId: user._id  });
  } catch (err) {
    res.status(500).json({ message: "Error en el login", error: err });
  }
};

export const profileData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
      const user = await User.findById(req.user).select("-password")
      if (!user) {
          res.status(404).json({ message: "Usuario no encontrado" });
          return
      }
      res.json({ user });
  } catch (error) {
      res.status(500).json({ message: "Error al obtener el perfil", error });
  }
}

const NOTIFICATION_PREF_KEYS = [
  "tournamentSignup",
  "tournamentStart",
  "tournamentResults",
  "matchResults",
  "leagueRoles"
] as const;

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, currentPassword, newPassword, notificationPrefs } = req.body as {
    username?: string;
    currentPassword?: string;
    newPassword?: string;
    notificationPrefs?: Partial<Record<(typeof NOTIFICATION_PREF_KEYS)[number], unknown>>;
  };

  try {
    const user = await User.findById(req.user);
      if (!user) {
          res.status(404).json({ message: "Usuario no encontrado" });
          return
      }

      let changed = false;

      if (username) {
        user.username = username;
        changed = true;
      }

      // Cada clave se valida por separado: un objeto parcial (solo la preferencia
      // que tocó el switch en la UI) es el caso normal, no un error.
      if (notificationPrefs && typeof notificationPrefs === "object") {
        for (const key of NOTIFICATION_PREF_KEYS) {
          const value = notificationPrefs[key];
          if (typeof value === "boolean") {
            user.notificationPrefs[key] = value;
            changed = true;
          }
        }
      }

      if (newPassword) {
          const isMatch = await bcrypt.compare(currentPassword ?? "", user.password);
          if (!isMatch) {
              res.status(400).json({ message: "La contraseña actual es incorrecta" });
              return
          }
          user.password = newPassword;
          changed = true;
      }

      if (!changed) {
        res.status(400).json({ message: "No se especificó ningún cambio" });
        return;
      }

      await user.save();

      // Mismo aviso que en el reset por link: es informativo, no bloquea la respuesta.
      if (newPassword) {
        void sendMail({ to: user.email, ...passwordChangedEmail(user.username) });
      }

      res.json({
        message: "Perfil actualizado correctamente",
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          notificationPrefs: user.notificationPrefs
        }
      });
  } catch (error) {
      res.status(500).json({ message: "Error al actualizar el perfil", error });
  }
}

/**
 * Genera un enlace de recuperación y lo envía por mail.
 * La respuesta es siempre la misma exista o no la cuenta, para no revelar
 * qué emails están registrados.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const genericResponse = {
    message: "Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña."
  };

  try {
    const email = (req.body?.email as string | undefined)?.trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      res.status(400).json({ message: "Ingresá un email válido" });
      return;
    }

    if (forgotPasswordLimiter.isLimited(email)) {
      res.status(429).json({
        message: "Demasiados intentos. Esperá unos minutos antes de volver a pedir el enlace."
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(200).json(genericResponse);
      return;
    }

    const token = generateToken();
    user.passwordResetToken = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
    await user.save();

    const content = passwordResetEmail(user.username, buildResetUrl(token), PASSWORD_RESET_TTL_MINUTES);
    const delivered = await sendMail({ to: user.email, ...content });

    // Si SMTP está configurado y el envío falló, el token queda inutilizable para
    // el usuario: se limpia para no dejar un enlace vivo que nadie recibió.
    // Sin SMTP (desarrollo) el enlace se imprime en consola, así que se conserva.
    if (!delivered && isMailConfigured()) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      res.status(502).json({
        message: "No pudimos enviar el mail de recuperación. Intentá de nuevo en unos minutos."
      });
      return;
    }

    res.status(200).json(genericResponse);
  } catch (error) {
    res.status(500).json({ message: "Error al procesar la solicitud", error });
  }
};

/** Permite al frontend saber si el enlace sigue siendo válido antes de mostrar el formulario. */
export const verifyResetToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await findUserByResetToken(req.params.token);

    if (!user) {
      res.status(400).json({ valid: false, message: "El enlace es inválido o ya venció" });
      return;
    }

    res.status(200).json({ valid: true, email: user.email });
  } catch (error) {
    res.status(500).json({ message: "Error al validar el enlace", error });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body as { password?: string };

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
      });
      return;
    }

    const user = await findUserByResetToken(req.params.token);
    if (!user) {
      res.status(400).json({ message: "El enlace es inválido o ya venció" });
      return;
    }

    // El hook pre-save hashea la contraseña y actualiza `passwordChangedAt`,
    // lo que invalida los tokens JWT emitidos antes del cambio.
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    forgotPasswordLimiter.reset(user.email);

    // El aviso es informativo: si falla no debe afectar al reseteo, que ya se aplicó.
    await sendMail({ to: user.email, ...passwordChangedEmail(user.username) });

    res.status(200).json({ message: "Contraseña actualizada. Ya podés iniciar sesión." });
  } catch (error) {
    res.status(500).json({ message: "Error al restablecer la contraseña", error });
  }
};

/** Confirma la cuenta a partir del link mandado en `notifyEmailVerification`. */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await findUserByVerificationToken(req.params.token);
    if (!user) {
      res.status(400).json({ message: "El enlace es inválido o ya venció" });
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Cuenta confirmada. Ya podés crear torneos y suscribirte a un plan." });
  } catch (error) {
    res.status(500).json({ message: "Error al confirmar la cuenta", error });
  }
};

/**
 * Reenvía el mail de confirmación. La respuesta es siempre la misma exista o
 * no la cuenta, para no revelar qué emails están registrados (mismo criterio
 * que `forgotPassword`).
 */
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  const genericResponse = {
    message: "Si el email está registrado y pendiente de confirmar, vas a recibir un nuevo enlace."
  };

  try {
    const email = (req.body?.email as string | undefined)?.trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      res.status(400).json({ message: "Ingresá un email válido" });
      return;
    }

    if (resendVerificationLimiter.isLimited(email)) {
      res.status(429).json({
        message: "Demasiados intentos. Esperá unos minutos antes de volver a pedir el enlace."
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user || user.emailVerified) {
      res.status(200).json(genericResponse);
      return;
    }

    const rawToken = generateToken();
    user.emailVerificationToken = hashToken(rawToken);
    user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
    await user.save();

    void notifyEmailVerification({ email: user.email, username: user.username }, rawToken);

    res.status(200).json(genericResponse);
  } catch (error) {
    res.status(500).json({ message: "Error al reenviar la confirmación", error });
  }
};

const UNSUBSCRIBE_PREF_LABELS: Record<string, string> = {
  tournamentSignup: "avisos de inscripción confirmada",
  tournamentStart: "avisos de inicio de torneo",
  tournamentResults: "avisos de resultados finales de torneo",
  matchResults: "avisos de resultado de cada partido",
  leagueRoles: "avisos de organizador de liga"
};

/**
 * Baja en un clic desde el link del mail: no requiere login a propósito (el
 * token HMAC de `unsubscribeToken.ts` es la única prueba de identidad que
 * hace falta para apagar UNA preferencia puntual). Método POST para que un
 * link previewer / bot de mail que hace GET no dé de baja por accidente.
 */
export const unsubscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const decoded = verifyUnsubscribeToken(req.params.token);
    if (!decoded) {
      res.status(400).json({ message: "El enlace de baja es inválido" });
      return;
    }

    const result = await User.updateOne(
      { _id: decoded.userId },
      { $set: { [`notificationPrefs.${decoded.pref}`]: false } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json({
      message: `Listo, ya no vas a recibir ${UNSUBSCRIBE_PREF_LABELS[decoded.pref] ?? "este tipo de aviso"}.`,
      pref: decoded.pref
    });
  } catch (error) {
    res.status(500).json({ message: "Error al procesar la baja", error });
  }
};