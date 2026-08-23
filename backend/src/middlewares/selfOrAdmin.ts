import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { isAdmin } from "./roleMiddleware";

/**
 * Resuelve `:paramName === 'me'` a `req.authUser.id` y exige que el recurso
 * pedido sea el propio usuario o que quien pide sea admin/superadmin.
 *
 * Las estadísticas de un usuario (con quién juega, calendario de actividad,
 * rivales) son un perfil bastante más revelador que un historial de
 * partidos suelto, así que a diferencia de otras rutas de `/users` no alcanza
 * con estar logueado: hace falta ser el propio usuario o un admin.
 *
 * Debe montarse siempre después de `authMiddleware`.
 */
export const requireSelfOrAdmin = (paramName = "id") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ message: "Acceso no autorizado" });
      return;
    }

    if (req.params[paramName] === "me") {
      req.params[paramName] = authUser.id;
    }

    const targetId = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ message: "Id de usuario inválido" });
      return;
    }

    if (targetId !== authUser.id && !isAdmin(authUser.role)) {
      res.status(403).json({ message: "No tenés permisos para ver estas estadísticas" });
      return;
    }

    next();
  };
};
