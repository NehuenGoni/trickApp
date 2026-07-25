import { Request, Response, NextFunction } from "express";
import { ROLES, ADMIN_ROLES } from "../config/constants";
import { UserRole } from "../models/User";

/**
 * Restringe el acceso a los roles indicados.
 * Debe montarse siempre después de `authMiddleware`, que es quien resuelve `req.authUser`.
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.authUser?.role;

    if (!role) {
      res.status(401).json({ message: "Acceso no autorizado" });
      return;
    }

    if (!roles.includes(role)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    next();
  };
};

/** Admin o superadmin: gestión de torneos, partidos y métricas. */
export const requireAdmin = requireRole(...(ADMIN_ROLES as UserRole[]));

/** Solo superadmin: gestión de usuarios, roles, contraseñas y puntos. */
export const requireSuperAdmin = requireRole(ROLES.SUPERADMIN);

export const isAdmin = (role?: UserRole): boolean =>
  !!role && (ADMIN_ROLES as UserRole[]).includes(role);
