import mongoose from "mongoose";
import League from "../models/League";
import { checkLeaguePlayerCap } from "../utils/leaguePlayers";
import { IdentifiablePlayer } from "../utils/playerIdentity";
import { PLAN_CATALOG } from "../config/plans";
import { notifyLeagueCapReached } from "./notifications";
import { notifyAdminLeagueCapHit } from "./adminAlerts";

/** Payload de un 402 por cupo de liga — mismo shape en cualquiera de los 6 puntos de entrada. */
export interface LeagueCapDenial {
  message: string;
  reason: "league_member_limit_reached";
  plan: string;
  limit: number;
  current: number;
  /** El front solo muestra el botón "Ver planes" cuando esto es `true`. */
  canUpgrade: boolean;
}

/**
 * Punto único de aplicación del cupo de jugadores por liga. Lo llaman los 5
 * handlers de alta de `tournament.controller.ts` y `applyTournamentUpdate`
 * (al vincular a la liga un torneo que ya tiene jugadores) — centralizarlo
 * acá evita que cada punto de entrada reimplemente a quién avisar y con qué
 * mensaje.
 *
 * Devuelve `null` si la operación puede seguir (no aplica cupo, o entra en
 * el que hay). Si la bloquea, YA disparó los avisos correspondientes
 * (admin + dueño de la liga, ambos fire-and-forget) — el llamador solo tiene
 * que cortar con un 402 usando el payload devuelto.
 */
export const enforceLeagueCap = async (
  leagueId: mongoose.Types.ObjectId | string | null | undefined,
  newPlayers: IdentifiablePlayer[],
  requesterId: string
): Promise<LeagueCapDenial | null> => {
  const check = await checkLeaguePlayerCap(leagueId, newPlayers, requesterId);
  if (!check || check.allowed) return null;

  const planLabel = PLAN_CATALOG[check.plan].label;
  // Cuántos de los nuevos entrarían sin pasarse del cupo — relevante en altas
  // masivas (`creatorAddSignup`), donde el rechazo es del lote entero: el
  // organizador necesita saber cuántos lugares le quedan, no solo que "no entra".
  const availableSlots = Math.max(0, check.limit - check.current);
  const message = check.isLeagueOwner
    ? `Llegaste al cupo de ${check.limit} jugadores de tu plan ${planLabel} (tenés ${check.current}, ` +
      `${availableSlots > 0 ? `quedan ${availableSlots} lugar(es)` : "sin lugares"}). ` +
      `Pasate a un plan superior para sumar más.`
    : "Esta liga alcanzó su cupo de jugadores. Hablá con el organizador.";

  void notifyAdminLeagueCapHit({
    ownerId: check.ownerId,
    plan: check.plan,
    current: check.current,
    limit: check.limit
  });

  // Si quien rebota no es el dueño (un jugador auto-inscribiéndose, o un
  // organizador que no es el dueño de la suscripción), el dueño no se entera
  // de nada por su cuenta — avisale por mail. Si fue él mismo, ya lo está
  // viendo en pantalla y el mail sería redundante.
  if (!check.isLeagueOwner) {
    const league = await League.findById(leagueId).select("name").lean();
    if (league) {
      void notifyLeagueCapReached(check.ownerId, {
        leagueName: league.name,
        leagueId: leagueId!.toString(),
        current: check.current,
        limit: check.limit,
        planLabel
      });
    }
  }

  return {
    message,
    reason: "league_member_limit_reached",
    plan: check.plan,
    limit: check.limit,
    current: check.current,
    canUpgrade: check.isLeagueOwner
  };
};
