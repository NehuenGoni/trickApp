import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import User, { UserRole } from "../models/User";
import Match from "../models/Match";
import TournamentModel from "../models/Tournament";
import { ROLES, MIN_PASSWORD_LENGTH } from "../config/constants";
import { sendMail } from "../utils/mailer";
import { passwordChangedEmail } from "../utils/emailTemplates";

interface AuthRequest extends Request {
  user?: string;
}

const PUBLIC_FIELDS = "-password";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidRole = (value: unknown): value is UserRole =>
  typeof value === "string" && (Object.values(ROLES) as string[]).includes(value);

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;

/** Evita que el sistema se quede sin ningún superadmin con acceso. */
const wouldRemoveLastSuperAdmin = async (
  targetId: string,
  currentRole: UserRole,
  nextRole?: UserRole
): Promise<boolean> => {
  if (currentRole !== ROLES.SUPERADMIN) return false;
  if (nextRole === ROLES.SUPERADMIN) return false;
  const remaining = await User.countDocuments({
    role: ROLES.SUPERADMIN,
    _id: { $ne: new mongoose.Types.ObjectId(targetId) }
  });
  return remaining === 0;
};

const generateTempPassword = (): string =>
  crypto.randomBytes(6).toString("base64url").slice(0, 10);

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const search = (req.query.search as string)?.trim();
    const role = req.query.role as string | undefined;

    const filter: Record<string, unknown> = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { username: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } }
      ];
    }
    if (role && isValidRole(role)) filter.role = role;

    const sortField = (req.query.sortBy as string) || "createdAt";
    const allowedSort = ["createdAt", "username", "email", "totalPoints", "role"];
    const sortBy = allowedSort.includes(sortField) ? sortField : "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(PUBLIC_FIELDS)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al listar usuarios", error: error.message });
  }
};

export const getUserDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }

    const user = await User.findById(id).select(PUBLIC_FIELDS);
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    const [matchesPlayed, tournamentsCreated, tournamentsPlayed] = await Promise.all([
      Match.countDocuments({ "teams.players.playerId": id }),
      TournamentModel.countDocuments({ createdBy: id }),
      TournamentModel.countDocuments({
        $or: [
          { "teams.players.playerId": id },
          { "individualSignups.userId": id },
          { "playerStats.playerId": id }
        ]
      })
    ]);

    res.status(200).json({
      user,
      stats: { matchesPlayed, tournamentsCreated, tournamentsPlayed }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener el usuario", error: error.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, email, role } = req.body as {
      username?: string;
      email?: string;
      role?: string;
    };

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }

    const user = await User.findById(id);
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 3) {
        return void res.status(400).json({
          message: "El nombre de usuario debe tener al menos 3 caracteres"
        });
      }
      user.username = trimmed;
    }

    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(trimmed)) {
        return void res.status(400).json({ message: "Email inválido" });
      }
      user.email = trimmed;
    }

    if (role !== undefined) {
      if (!isValidRole(role)) {
        return void res.status(400).json({
          message: `Rol inválido (${Object.values(ROLES).join(" | ")})`
        });
      }
      if (id === req.user && role !== ROLES.SUPERADMIN) {
        return void res.status(400).json({
          message: "No podés quitarte a vos mismo el rol de superadmin"
        });
      }
      if (await wouldRemoveLastSuperAdmin(id, user.role, role)) {
        return void res.status(400).json({
          message: "No se puede degradar al último superadmin del sistema"
        });
      }
      user.role = role;
    }

    await user.save();

    const updated = await User.findById(id).select(PUBLIC_FIELDS);
    res.status(200).json({ message: "Usuario actualizado", user: updated });
  } catch (error: any) {
    if (isDuplicateKeyError(error)) {
      return void res.status(409).json({ message: "Ese email ya está en uso" });
    }
    res.status(500).json({ message: "Error al actualizar el usuario", error: error.message });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body as { newPassword?: string };

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }

    const user = await User.findById(id);
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    const generated = !newPassword;
    const password = newPassword ?? generateTempPassword();

    if (password.length < MIN_PASSWORD_LENGTH) {
      return void res.status(400).json({
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
      });
    }

    // El hook pre-save hashea y marca `passwordChangedAt`, lo que invalida
    // cualquier token que el usuario tuviera activo.
    user.password = password;
    await user.save();

    // Los campos de recuperación se cargan con `select: false`, así que se limpian
    // aparte: un enlace de "olvidé mi contraseña" pendiente ya no debe servir.
    await User.updateOne(
      { _id: user._id },
      { $unset: { passwordResetToken: "", passwordResetExpires: "" } }
    );

    // Mismo aviso informativo que el cambio de contraseña por el propio usuario:
    // si no fue él, que se entere apenas pueda.
    void sendMail({ to: user.email, ...passwordChangedEmail(user.username) });

    res.status(200).json({
      message: `Contraseña de ${user.username} restablecida. Sus sesiones activas se cerraron.`,
      // Solo se devuelve la contraseña cuando la generó el servidor: es la única
      // forma de que el admin pueda comunicársela al usuario.
      ...(generated ? { temporaryPassword: password } : {})
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al restablecer la contraseña", error: error.message });
  }
};

export const adjustUserPoints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { mode, value, reason } = req.body as {
      mode?: "set" | "delta";
      value?: number;
      reason?: string;
    };

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }
    if (mode !== "set" && mode !== "delta") {
      return void res.status(400).json({ message: "Modo inválido (set | delta)" });
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return void res.status(400).json({ message: "El valor debe ser un número" });
    }
    if (!reason || !reason.trim()) {
      return void res.status(400).json({ message: "El motivo del ajuste es obligatorio" });
    }

    const user = await User.findById(id);
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    const current = user.totalPoints ?? 0;
    const next = mode === "set" ? value : current + value;
    if (next < 0) {
      return void res.status(400).json({ message: "Los puntos no pueden quedar en negativo" });
    }

    const delta = next - current;
    if (delta === 0) {
      return void res.status(400).json({ message: "El ajuste no cambia los puntos actuales" });
    }

    user.totalPoints = next;
    user.pointsAdjustments.push({
      delta,
      reason: reason.trim(),
      adjustedBy: req.user ? new mongoose.Types.ObjectId(req.user) : undefined,
      adjustedAt: new Date()
    });
    await user.save();

    res.status(200).json({
      message: `Puntos actualizados: ${current} → ${next}`,
      totalPoints: next,
      delta
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al ajustar los puntos", error: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }
    if (id === req.user) {
      return void res.status(400).json({ message: "No podés eliminar tu propia cuenta" });
    }

    const user = await User.findById(id);
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }
    if (await wouldRemoveLastSuperAdmin(id, user.role)) {
      return void res.status(400).json({
        message: "No se puede eliminar al último superadmin del sistema"
      });
    }

    const activeTournaments = await TournamentModel.countDocuments({
      createdBy: id,
      status: { $in: ["upcoming", "in_progress"] }
    });
    if (activeTournaments > 0) {
      return void res.status(409).json({
        message: `El usuario es organizador de ${activeTournaments} torneo(s) sin finalizar. Finalizalos o eliminalos antes de borrar la cuenta.`
      });
    }

    // Se lo quita de las inscripciones abiertas; el historial de partidos y
    // torneos jugados conserva el nombre embebido y no se toca.
    await TournamentModel.updateMany(
      { status: "upcoming" },
      {
        $pull: {
          individualSignups: { userId: user._id },
          teams: { "players.playerId": user._id }
        }
      }
    );

    await user.deleteOne();
    res.status(200).json({ message: `Usuario ${user.username} eliminado` });
  } catch (error: any) {
    res.status(500).json({ message: "Error al eliminar el usuario", error: error.message });
  }
};
