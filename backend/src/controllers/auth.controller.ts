import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User";
import dotenv from "dotenv";
import { MIN_PASSWORD_LENGTH, PASSWORD_RESET_TTL_MINUTES } from "../config/constants";
import { sendMail, isMailConfigured, passwordResetEmail, passwordChangedEmail } from "../utils/mailer";
import { createRateLimiter } from "../utils/rateLimiter";

dotenv.config();

interface AuthRequest extends Request {
  user?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Máximo 3 pedidos de recuperación por email cada 15 minutos. */
const forgotPasswordLimiter = createRateLimiter(3, 15 * 60 * 1000);

const hashResetToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildResetUrl = (token: string): string => {
  const base = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/reset-password/${token}`;
};

/** Busca el usuario dueño de un token de recuperación vigente. */
const findUserByResetToken = async (token: string) =>
  User.findOne({
    passwordResetToken: hashResetToken(token),
    passwordResetExpires: { $gt: new Date() }
  }).select("+passwordResetToken +passwordResetExpires");

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, email, password } = req.body;
  
      const userExists = await User.findOne({ email });
      if (userExists) {
        res.status(400).json({ message: "Usuario ya existe" });
        return;
      }
  
      const newUser = new User({
        username,
        email,
        password,
      });
  
      await newUser.save();
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

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user);
      if (!user) {
          res.status(404).json({ message: "Usuario no encontrado" });
          return 
      }

      if (username && !newPassword) {
          user.username = username;
          await user.save();
          res.json({ message: "Nombre de usuario actualizado correctamente" });
          return 
      }

      if (newPassword) {
          const isMatch = await bcrypt.compare(currentPassword, user.password);
          if (!isMatch) {
              res.status(400).json({ message: "La contraseña actual es incorrecta" });
              return
          }
          user.password = newPassword;
          if (username) user.username = username;
          await user.save();
          res.json({ message: "Perfil actualizado correctamente" });
          return
      }
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

    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = hashResetToken(token);
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