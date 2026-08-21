import { Request, Response, NextFunction } from "express";
import { isAdmin } from "../middlewares/roleMiddleware";
import { UserRole, IBilling } from "../models/User";
import { ILeague } from "../models/League";
import { hasActiveSubscription } from "../services/billing";

interface LeagueActor {
  id: string;
  role: UserRole;
  billing?: IBilling;
}

/**
 * PUNTO ÚNICO DE DECISIÓN de quién puede administrar ligas (crear, editar,
 * borrar, agregar/quitar torneos, y setear `league` al crear/editar un torneo).
 *
 * Admin/superadmin siempre puede (panel de soporte). Cualquier otro usuario
 * necesita una suscripción paga vigente — es el gate principal de todo el
 * modelo de negocio: sin él, cualquiera crearía ligas gratis. `billing` viaja
 * en `req.authUser` desde `authMiddleware`, así que esto no dispara ninguna
 * query extra.
 */
export const canManageLeagues = (actor?: LeagueActor): boolean =>
  isAdmin(actor?.role) || hasActiveSubscription(actor?.billing);

/**
 * Variante por documento: admin/superadmin, el `createdBy` de la liga, o uno
 * de sus `organizers`. Antes delegaba el caso general en `canManageLeagues`,
 * lo que dejaba a CUALQUIER suscriptor activo (no solo al dueño/organizador
 * de esta liga puntual) asignar o desvincular torneos de una liga ajena. El
 * gate de suscripción de `canManageLeagues` sigue siendo el que decide quién
 * puede CREAR una liga nueva — acá lo que importa es quién puede tocar ESTA.
 * Coherente con `canManageTournament` (`utils/tournamentAccess.ts`), que ya
 * contemplaba organizadores.
 */
export const canManageLeague = (
  actor: LeagueActor | undefined,
  league: Pick<ILeague, "createdBy" | "organizers">
): boolean =>
  isAdmin(actor?.role) ||
  (!!actor &&
    (league.createdBy?.toString() === actor.id ||
      (league.organizers ?? []).some((organizerId) => organizerId.toString() === actor.id)));

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
