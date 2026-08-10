import { ITournament } from "../models/Tournament";
import League from "../models/League";
import { isAdmin } from "../middlewares/roleMiddleware";
import { UserRole } from "../models/User";

interface Actor {
  id: string;
  role: UserRole;
}

/**
 * PUNTO ÚNICO DE DECISIÓN de quién puede gestionar un torneo: editarlo,
 * borrarlo, sortearlo, iniciarlo, inscribir/quitar jugadores, reorganizar
 * equipos, o tocar su logo.
 *
 * Orden de evaluación:
 *  1. Admin/superadmin: siempre.
 *  2. Creador del torneo (`tournament.createdBy`): se conserva SIEMPRE, tenga
 *     o no liga el torneo — es lo único que autoriza los torneos legacy (sin
 *     liga) y no cambia el comportamiento actual para nadie.
 *  3. Si el torneo pertenece a una liga: el dueño de la liga
 *     (`League.createdBy`) o alguno de sus organizadores (`League.organizers`).
 *
 * Esto es lo que resuelve el problema operativo real: hoy, si el creador del
 * torneo no está esa noche en el bar, nadie más puede tocarlo. Con un
 * organizador designado, cualquiera de ellos puede seguir operando el torneo
 * aunque el creador original no esté presente.
 *
 * Hace una query extra (la liga) solo cuando hace falta: los casos 1 y 2, que
 * son los más frecuentes, resuelven sin tocar la base.
 */
export const canManageTournament = async (
  tournament: Pick<ITournament, "createdBy" | "league">,
  actor?: Actor
): Promise<boolean> => {
  if (!actor) return false;
  if (isAdmin(actor.role)) return true;
  if (tournament.createdBy?.toString() === actor.id) return true;
  if (!tournament.league) return false;

  const league = await League.findById(tournament.league).select("createdBy organizers");
  if (!league) return false;
  if (league.createdBy?.toString() === actor.id) return true;
  return (league.organizers ?? []).some((organizerId) => organizerId.toString() === actor.id);
};
