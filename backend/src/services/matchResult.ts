import mongoose from "mongoose";
import Match, { IMatch, IMatchTeam } from "../models/Match";
import TournamentModel, { ITournament } from "../models/Tournament";
import { MATCH_STATUS } from "../config/constants";
import { positionsFromSlot } from "../utils/bracket";
import {
  closeTournament,
  computePlayerStats,
  awardTournamentPoints,
  revertTournamentPoints
} from "../controllers/tournament.controller";

/**
 * PUNTO ÚNICO de la propagación de resultados en el cuadro: quién empuja a
 * quién (`propagateResult`), cómo se deshace esa propagación
 * (`detachDownstream`) y cuándo eso alcanza para cerrar el torneo
 * (`maybeCloseTournament`).
 *
 * Antes vivía duplicado: `advanceWinnerLoser` en `match.controller.ts` (el
 * marcador en vivo) y `propagateResult`/`rollbackDownstream` en
 * `adminTournament.controller.ts` (el panel de admin) hacían lo mismo con
 * código distinto. Ahora los dos caminos —y la carga manual del organizador,
 * `setMatchResult`/`clearMatchResult`— pasan por acá.
 */

const enrichTeam = (match: IMatch, teamId: mongoose.Types.ObjectId | undefined): IMatchTeam | null => {
  if (!teamId) return null;
  const t = match.teams.find((x) => x.teamId.toString() === teamId.toString());
  if (!t) return null;
  return {
    teamId: t.teamId,
    score: 0,
    players: t.players.map((p) => ({
      playerId: p.playerId,
      username: p.username,
      isGuest: !!p.isGuest
    }))
  } as IMatchTeam;
};

const pushTeam = async (
  targetId: mongoose.Types.ObjectId | undefined,
  team: IMatchTeam | null
): Promise<IMatch | null> => {
  if (!targetId || !team) return null;
  const target = await Match.findById(targetId);
  if (!target) return null;
  const already = target.teams.some((t) => t.teamId.toString() === team.teamId.toString());
  if (!already) {
    target.teams.push(team);
    if (target.teams.length === 2 && target.status === MATCH_STATUS.PENDING) {
      target.status = MATCH_STATUS.IN_PROGRESS;
    }
    await target.save();
  }
  return target;
};

export interface PropagationResult {
  winnerTarget: IMatch | null;
  loserTarget: IMatch | null;
}

/**
 * Empuja ganador y perdedor de `match` a `feedsWinnerTo`/`feedsLoserTo`.
 * Idempotente: si el equipo ya estaba en el destino, no lo duplica (guard
 * `already` en `pushTeam`) — necesario porque tanto el marcador en vivo como
 * la carga manual pueden reintentar sobre el mismo partido.
 */
export const propagateResult = async (match: IMatch): Promise<PropagationResult> => {
  if (!match.winner || !match.losingTeam) return { winnerTarget: null, loserTarget: null };

  const winnerTeam = enrichTeam(match, match.winner as mongoose.Types.ObjectId);
  const loserTeam = enrichTeam(match, match.losingTeam as mongoose.Types.ObjectId);

  const winnerTarget = await pushTeam(match.feedsWinnerTo as mongoose.Types.ObjectId, winnerTeam);
  const loserTarget = await pushTeam(match.feedsLoserTo as mongoose.Types.ObjectId, loserTeam);

  return { winnerTarget, loserTarget };
};

/**
 * Destinos directos de `match` que ya están `finished` — es decir, que ya
 * decidieron su propio resultado usando el equipo que `match` les empujó.
 * Si esta lista no está vacía, cambiar el ganador de `match` requeriría
 * revertir esos partidos en cascada; el organizador lo hace a mano, de a un
 * partido por vez, con "Deshacer resultado" (ver `clearMatchResult`).
 *
 * Si `match` todavía no está finalizado, sus destinos nunca pueden estar
 * `finished` (un partido necesita sus 2 equipos para terminar, y uno de ellos
 * solo llega cuando `match` se finaliza), así que esto siempre da vacío para
 * la primera carga de un resultado.
 */
export const downstreamBlockers = async (match: IMatch): Promise<IMatch[]> => {
  const targetIds = [match.feedsWinnerTo, match.feedsLoserTo].filter(
    (id): id is mongoose.Types.ObjectId => !!id
  );
  if (targetIds.length === 0) return [];
  return Match.find({ _id: { $in: targetIds }, status: MATCH_STATUS.FINISHED });
};

/**
 * Deshace la propagación de un partido ya finalizado: saca los equipos que
 * había empujado a las siguientes rondas y, si esas rondas ya se habían
 * jugado, las revierte también en cascada. La recursión está acotada por la
 * profundidad del cuadro (`log2(numberOfTeams)` niveles como máximo — 5
 * incluso en el torneo más grande, 32 equipos).
 *
 * Recibe `match` con su winner/losingTeam/feedsWinnerTo/feedsLoserTo TODAVÍA
 * sin mutar — quien llama tiene que invocar esto antes de reasignarle un
 * nuevo ganador.
 */
export const detachDownstream = async (match: IMatch): Promise<number> => {
  let reverted = 0;

  const detach = async (
    targetId: mongoose.Types.ObjectId | undefined,
    teamId: mongoose.Types.ObjectId | undefined
  ) => {
    if (!targetId || !teamId) return;
    const target = await Match.findById(targetId);
    if (!target) return;

    const hadTeam = target.teams.some((t) => t.teamId.toString() === teamId.toString());
    if (!hadTeam) return;

    if (target.status === MATCH_STATUS.FINISHED) {
      reverted += await detachDownstream(target);
      target.winner = undefined;
      target.losingTeam = undefined;
    }

    target.teams = target.teams.filter(
      (t) => t.teamId.toString() !== teamId.toString()
    ) as typeof target.teams;
    target.status = target.teams.length === 2 ? MATCH_STATUS.IN_PROGRESS : MATCH_STATUS.PENDING;
    for (const t of target.teams) t.score = 0;

    await target.save();
    reverted += 1;
  };

  await detach(match.feedsWinnerTo as mongoose.Types.ObjectId, match.winner as mongoose.Types.ObjectId);
  await detach(match.feedsLoserTo as mongoose.Types.ObjectId, match.losingTeam as mongoose.Types.ObjectId);

  return reverted;
};

/** Un slot "decide algo" cuando `positionsFromSlot` resuelve al menos un lado. */
const isDecisiveSlot = (slot?: string | null): boolean => {
  if (!slot) return false;
  const outcome = positionsFromSlot(slot);
  return !!outcome && (outcome.winner !== null || outcome.loser !== null);
};

/**
 * Revierte los puntos otorgados y los vuelve a calcular desde los partidos,
 * sin tocar `status` ni disparar el email de "torneo cerrado" — a diferencia
 * de `closeTournament`, que sí lo hace. Es lo que usa `maybeCloseTournament`
 * en modo "resync": cuando una corrección reabre un torneo que YA había
 * cerrado y, al terminar de propagar, vuelve a estar completo, no hace falta
 * re-notificar el cierre — ya se avisó el resultado del partido corregido.
 */
export const resyncTournamentPoints = async (
  tournament: ITournament & mongoose.Document
): Promise<void> => {
  await revertTournamentPoints(tournament);
  tournament.playerStats = await computePlayerStats(tournament);
  await awardTournamentPoints(tournament);
};

/**
 * Cierra el torneo si, tras propagar `bracketSlot`, ya no queda ningún
 * partido decisivo sin terminar.
 *
 * - `mode: "close"` (default): el cierre normal, con `closeTournament` —
 *   recalcula puntos, marca `completed` y avisa por mail. Es lo que usa el
 *   flujo automático (marcador en vivo, primera carga manual).
 * - `mode: "resync"`: para cuando el torneo YA estaba `completed` y una
 *   corrección lo reabrió transitoriamente (ver `setMatchResult`) — al volver
 *   a estar completo, solo hace falta recalcular puntos y posiciones, sin
 *   volver a mailear el cierre.
 */
export const maybeCloseTournament = async (
  tournamentId: mongoose.Types.ObjectId | string,
  bracketSlot: string | null | undefined,
  mode: "close" | "resync" = "close"
): Promise<boolean> => {
  if (!isDecisiveSlot(bracketSlot)) return false;

  const pending = await Match.find({
    tournament: tournamentId,
    status: { $ne: MATCH_STATUS.FINISHED }
  }).select("bracketSlot");
  const remaining = pending.filter((m) => isDecisiveSlot(m.bracketSlot)).length;
  if (remaining > 0) return false;

  if (mode === "resync") {
    const tournament = await TournamentModel.findById(tournamentId);
    if (!tournament) return false;
    await resyncTournamentPoints(tournament);
    tournament.status = "completed";
    await tournament.save();
  } else {
    await closeTournament(tournamentId);
  }
  return true;
};
