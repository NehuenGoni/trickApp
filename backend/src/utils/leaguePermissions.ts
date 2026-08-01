import { Request, Response, NextFunction } from "express";
import { isAdmin } from "../middlewares/roleMiddleware";
import { UserRole } from "../models/User";
import { ILeague } from "../models/League";

interface LeagueActor {
  id: string;
  role: UserRole;
}

/**
 * PUNTO ÚNICO DE DECISIÓN de quién puede administrar ligas (crear, editar,
 * borrar, agregar/quitar torneos, y setear `league` al crear/editar un torneo).
 *
 * Hoy es provisional: solo admin/superadmin, igual que el resto del panel.
 * El plan es reemplazarlo por un sistema de suscripción todavía no
 * desarrollado. Cuando exista, este archivo es lo ÚNICO que hay que tocar —
 * por eso cada mutación de liga (acá y en tournament.controller.ts /
 * adminTournament.controller.ts) pasa por estas funciones en vez de
 * chequear el rol a mano.
 */
export const canManageLeagues = (actor?: LeagueActor): boolean => isAdmin(actor?.role);

/**
 * Variante por documento: admin/superadmin, o el `createdBy` de la liga.
 * Deja el hueco para el día en que esto se reemplace por un sistema de
 * suscripción (ver comentario de arriba).
 */
export const canManageLeague = (
  actor: LeagueActor | undefined,
  league: Pick<ILeague, "createdBy">
): boolean =>
  canManageLeagues(actor) || (!!actor && league.createdBy?.toString() === actor.id);

/** Middleware de ruta. Debe montarse siempre después de `authMiddleware`. */
export const requireLeagueManager = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.authUser) {
    res.status(401).json({ message: "Acceso no autorizado" });
    return;
  }
  if (!canManageLeagues(req.authUser)) {
    res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
    return;
  }
  next();
};
