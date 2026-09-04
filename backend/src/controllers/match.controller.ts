import { Request, Response } from "express";
import mongoose from "mongoose";
import Match, { IMatch, IMatchTeam } from "../models/Match";
import Tournament from "../models/Tournament";
import { MATCH_TYPES, MATCH_STATUS, MAX_SCORE, MATCH_PHASE_LABELS } from "../config/constants";
import { positionsFromSlot } from "../utils/bracket";
import { revertTournamentPoints } from "./tournament.controller";
import { canManageTournament } from "../utils/tournamentAccess";
import { notifyMatchResults, resolveUsers, MatchResultEntry } from "../services/notifications";
import {
  propagateResult,
  downstreamBlockers,
  detachDownstream,
  maybeCloseTournament
} from "../services/matchResult";

interface AuthRequest extends Request {
  user?: string;
}

// Solo restringe partidos de torneo: en un amistoso el modelo Match no guarda
// quién lo creó, así que no hay contra qué autorizar (un amistoso entre
// invitados no tiene ningún playerId). Se deja igual de laxo que hoy.
// En torneo, puede modificarlo quien juega el partido o quien gestiona el
// torneo (creador, o dueño/organizador de su liga — ver tournamentAccess.ts).
const canModifyMatch = async (match: IMatch, req: AuthRequest): Promise<boolean> => {
  if (match.type !== MATCH_TYPES.TOURNAMENT) return true;

  const isPlayer = match.teams.some((t) =>
    t.players.some((p) => p.playerId && p.playerId.toString() === req.user)
  );
  if (isPlayer) return true;

  if (!match.tournament) return false;
  const tournament = await Tournament.findById(match.tournament);
  return !!tournament && (await canManageTournament(tournament, req.authUser));
};

export const createMatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournament, teams, type, phase } = req.body;

    if (!Array.isArray(teams)) {
      return void res.status(400).json({
        message: "El campo 'teams' debe ser un array",
        error: { received: teams }
      });
    }

    const matchData: Record<string, unknown> = {
      teams,
      status: MATCH_STATUS.IN_PROGRESS,
      type
    };

    if (type === MATCH_TYPES.TOURNAMENT) {
      if (!tournament) {
        return void res.status(400).json({
          message: "Se requiere un torneo para partidos de tipo torneo",
          error: { type, tournament }
        });
      }
      const tournamentData = await Tournament.findById(tournament);
      if (!tournamentData) {
        return void res.status(404).json({
          message: "Torneo no encontrado",
          error: { tournamentId: tournament }
        });
      }
      matchData.tournament = tournament;
      if (phase) matchData.phase = phase;
      const match = new Match(matchData);
      await match.save();
      tournamentData.matches.push(match._id as mongoose.Types.ObjectId);
      await tournamentData.save();
      return void res.status(201).json(match);
    }

    matchData.type = MATCH_TYPES.FRIENDLY;
    const match = new Match(matchData);
    await match.save();
    res.status(201).json(match);
  } catch (error) {
    const err = error as { name?: string; message?: string };
    res.status(400).json({
      message: "Error al crear el partido",
      error: { name: err.name, message: err.message }
    });
  }
};

export const getMatches = async (_req: Request, res: Response): Promise<void> => {
  try {
    const matches = await Match.find();
    for (const match of matches) {
      if (match.type === MATCH_TYPES.TOURNAMENT) {
        await match.populate("tournament");
      }
    }
    res.status(200).json(matches);
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al obtener los partidos", error: { message: err.message } });
  }
};

export const getInProgressMatches = async (_req: Request, res: Response): Promise<void> => {
  try {
    const matches = await Match.find({ status: MATCH_STATUS.IN_PROGRESS }).sort({
      createdAt: -1
    });
    for (const match of matches) {
      if (match.type === MATCH_TYPES.TOURNAMENT) {
        await match.populate("tournament");
      }
    }
    res.status(200).json(matches);
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al obtener los partidos en curso", error: { message: err.message } });
  }
};

export const getMatchById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      res
        .status(400)
        .json({ message: "ID de partido inválido", error: { id: req.params.id } });
      return;
    }
    const match = await Match.findById(req.params.id);
    if (!match) {
      res
        .status(404)
        .json({ message: "Partido no encontrado", error: { id: req.params.id } });
      return;
    }
    res.status(200).json(match);
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al obtener el partido", error: { message: err.message } });
  }
};

interface MatchResultPlayerInfo {
  playerId: string;
  won: boolean;
  nextPhaseLabel: string | null;
  finalPosition: number | null;
}

/**
 * Arma, por jugador registrado (invitados sin `playerId` quedan afuera), si
 * ganó o perdió, a qué fase sigue (si el equipo avanzó a otro match) o en qué
 * posición terminó (si ese lado ya no tenía adónde avanzar — ver
 * `positionsFromSlot` en `utils/bracket.ts`: en una zona de tamaño impar el
 * perdedor puede quedar decidido solo, sin que el ganador lo esté todavía).
 */
const collectMatchResultInfos = (
  bracketSlot: string,
  winnerTeam: IMatchTeam | null,
  loserTeam: IMatchTeam | null,
  winnerTarget: IMatch | null,
  loserTarget: IMatch | null
): MatchResultPlayerInfo[] => {
  const outcome = positionsFromSlot(bracketSlot);
  const infos: MatchResultPlayerInfo[] = [];

  const addTeam = (team: IMatchTeam | null, won: boolean, target: IMatch | null, position: number | null) => {
    if (!team) return;
    // MATCH_PHASE_LABELS solo traduce los códigos legacy (torneos de 8
    // equipos); para un tamaño nuevo `target.phase` ya viene en español
    // (`phaseLabelFor`), así que el fallback es usarlo tal cual.
    const nextPhaseLabel = target?.phase
      ? MATCH_PHASE_LABELS[target.phase as keyof typeof MATCH_PHASE_LABELS] ?? target.phase
      : null;
    const finalPosition = !target ? position : null;
    for (const player of team.players) {
      if (!player.playerId) continue; // invitados: sin cuenta, sin email.
      infos.push({ playerId: player.playerId.toString(), won, nextPhaseLabel, finalPosition });
    }
  };

  addTeam(winnerTeam, true, winnerTarget, outcome?.winner ?? null);
  addTeam(loserTeam, false, loserTarget, outcome?.loser ?? null);
  return infos;
};

const advanceWinnerLoser = async (
  current: IMatch
): Promise<void> => {
  if (!current.winner || !current.losingTeam) return;

  const winnerTeam = current.teams.find(
    (t) => t.teamId.toString() === (current.winner as mongoose.Types.ObjectId).toString()
  ) as IMatchTeam | undefined;
  const loserTeam = current.teams.find(
    (t) => t.teamId.toString() === (current.losingTeam as mongoose.Types.ObjectId).toString()
  ) as IMatchTeam | undefined;

  const { winnerTarget, loserTarget } = await propagateResult(current);

  // Aviso de resultado de partido: opt-in (`notificationPrefs.matchResults`),
  // ver la advertencia de volumen del plan — es el evento de mayor frecuencia
  // de todo el sistema de notificaciones.
  if (current.type !== MATCH_TYPES.TOURNAMENT || !current.tournament || !current.bracketSlot) return;

  const infos = collectMatchResultInfos(
    current.bracketSlot,
    winnerTeam ?? null,
    loserTeam ?? null,
    winnerTarget,
    loserTarget
  );
  if (infos.length === 0) return;

  const [tournament, recipients] = await Promise.all([
    Tournament.findById(current.tournament).select("name"),
    resolveUsers(infos.map((i) => i.playerId))
  ]);
  if (!tournament) return;

  const byId = new Map(recipients.map((u) => [String(u._id), u]));
  const entries: MatchResultEntry[] = infos.flatMap((info) => {
    const user = byId.get(info.playerId);
    return user
      ? [{ user, won: info.won, nextPhaseLabel: info.nextPhaseLabel, finalPosition: info.finalPosition }]
      : [];
  });
  void notifyMatchResults(entries, tournament.name, String(current.tournament));
};

export const updateMatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teams, winner, status } = req.body as {
      teams?: IMatchTeam[];
      winner?: string;
      status?: string;
    };

    const match = await Match.findById(req.params.id);
    if (!match) {
      return void res.status(404).json({ message: "Partido no encontrado" });
    }

    if (!(await canModifyMatch(match, req))) {
      return void res.status(403).json({ message: "No tenés permiso para modificar este partido" });
    }

    if (match.status === MATCH_STATUS.FINISHED && status !== undefined) {
      return void res.status(409).json({ message: "El partido ya está finalizado" });
    }

    if (Array.isArray(teams)) {
      for (const t of teams) {
        if (typeof t.score === "number" && (t.score < 0 || t.score > MAX_SCORE)) {
          return void res.status(400).json({
            message: `Score inválido (debe estar entre 0 y ${MAX_SCORE})`
          });
        }
      }
      const reachingMax = teams.filter((t) => t.score === MAX_SCORE).length;
      if (reachingMax > 1) {
        res
          .status(400)
          .json({ message: "Dos equipos no pueden alcanzar el máximo simultáneamente" });
        return;
      }
      match.teams = teams as unknown as typeof match.teams;
    }

    if (status === MATCH_STATUS.IN_PROGRESS) {
      if (match.status === MATCH_STATUS.PENDING && match.teams.length < 2) {
        res
          .status(400)
          .json({ message: "El partido no puede iniciar sin los 2 equipos asignados" });
        return;
      }
      match.status = MATCH_STATUS.IN_PROGRESS;
    }

    if (status === MATCH_STATUS.FINISHED) {
      if (!winner) {
        return void res.status(400).json({ message: "Falta el winner para finalizar" });
      }
      const winnerInTeams = match.teams.some(
        (t) => t.teamId.toString() === winner.toString()
      );
      if (!winnerInTeams) {
        res
          .status(400)
          .json({ message: "El winner debe ser uno de los equipos del partido" });
        return;
      }
      match.winner = new mongoose.Types.ObjectId(winner);
      const loser = match.teams.find((t) => t.teamId.toString() !== winner.toString());
      if (loser) match.losingTeam = loser.teamId;
      match.status = MATCH_STATUS.FINISHED;
    }

    await match.save();

    if (match.status === MATCH_STATUS.FINISHED && match.type === MATCH_TYPES.TOURNAMENT) {
      await advanceWinnerLoser(match);

      // El torneo está listo para cerrar cuando ya no queda ningún partido
      // decisivo sin terminar (ver `maybeCloseTournament` en
      // `services/matchResult.ts`, que hace ese chequeo y también lo usan el
      // panel de admin y la carga manual del organizador).
      if (match.tournament) {
        await maybeCloseTournament(match.tournament as mongoose.Types.ObjectId, match.bracketSlot);
      }
    }

    res.status(200).json(match);
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al actualizar el partido", error: { message: err.message } });
  }
};

export const updateMatchScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { scores } = req.body as {
      scores?: { teamId: string; score: number }[];
    };

    if (!Array.isArray(scores) || scores.length === 0) {
      return void res.status(400).json({ message: "El campo 'scores' debe ser un array no vacío" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return void res.status(404).json({ message: "Partido no encontrado" });
    }

    if (!(await canModifyMatch(match, req))) {
      return void res.status(403).json({ message: "No tenés permiso para modificar este partido" });
    }

    if (match.status === MATCH_STATUS.FINISHED) {
      return void res.status(409).json({ message: "El partido ya está finalizado" });
    }

    for (const s of scores) {
      if (typeof s.score !== "number" || s.score < 0 || s.score > MAX_SCORE) {
        return void res.status(400).json({
          message: `Score inválido (debe estar entre 0 y ${MAX_SCORE})`
        });
      }
    }

    const reachingMax = scores.filter((s) => s.score === MAX_SCORE).length;
    if (reachingMax > 1) {
      return void res
        .status(400)
        .json({ message: "Dos equipos no pueden alcanzar el máximo simultáneamente" });
    }

    for (const s of scores) {
      const team = match.teams.find((t) => t.teamId.toString() === s.teamId.toString());
      if (!team) {
        return void res.status(400).json({
          message: "teamId no pertenece a este partido",
          error: { teamId: s.teamId }
        });
      }
      team.score = s.score;
    }

    await match.save();

    res.status(200).json(match);
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al actualizar el marcador", error: { message: err.message } });
  }
};

export const deleteMatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return void res.status(404).json({ message: "Partido no encontrado" });
    }
    if (!(await canModifyMatch(match, req))) {
      return void res.status(403).json({ message: "No tenés permiso para eliminar este partido" });
    }
    if (match.tournament) {
      const tournament = await Tournament.findById(match.tournament);
      if (tournament && tournament.status === "in_progress") {
        return void res.status(400).json({
          message: "No se pueden borrar partidos de un torneo en curso"
        });
      }
    }
    await match.deleteOne();
    res.status(200).json({ message: "Partido eliminado correctamente" });
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al eliminar el partido", error: { message: err.message } });
  }
};

interface SetResultBody {
  scores?: { teamId: string; score: number }[];
  confirmReopen?: boolean;
}

/**
 * El truco se juega hasta 30. Exactamente un equipo tiene que llegar a ese
 * número para que el resultado sea válido — es la misma regla que ya aplica
 * `updateMatchScore` (dos equipos en 30 a la vez es un estado imposible), pero
 * acá además hace falta que ALGUNO de los dos haya llegado: a diferencia del
 * marcador en vivo (que finaliza solo), acá el ganador nunca se manda
 * explícito, se deduce del marcador para que no se pueda cargar un resultado
 * que no cierra como una mano de truco real.
 */
const trucoOutcome = (
  scores: { teamId: string; score: number }[]
): { winnerId: string; loserId: string } | null => {
  const winners = scores.filter((s) => s.score === MAX_SCORE);
  if (winners.length !== 1) return null;
  const loser = scores.find((s) => s.teamId !== winners[0].teamId);
  if (!loser) return null;
  return { winnerId: winners[0].teamId, loserId: loser.teamId };
};

const blockersPayload = (blockers: IMatch[]) =>
  blockers.map((b) => ({ _id: b._id, phase: b.phase, bracketSlot: b.bracketSlot }));

/**
 * Carga o corrige a mano el resultado final de un partido de torneo — la
 * "planilla" del organizador: en vez de llevar el marcador punto a punto
 * desde el celular de un jugador (`PATCH /matches/:id/score` +
 * `PUT /matches/:id`, que usa `Scoreboard`), el organizador tipea el
 * marcador final directamente. Solo para quien gestiona el torneo
 * (`canManageTournament`): un jugador sigue usando el marcador en vivo.
 *
 * Reutiliza el mismo cableado de bracket que el marcador en vivo
 * (`propagateResult`/`maybeCloseTournament` de `services/matchResult.ts`), así
 * que cargar a mano no puede desviar a nadie de la rama que le corresponde.
 *
 * Corregir un partido YA finalizado está permitido, pero acotado para no
 * perder trabajo sin que el organizador lo pida: si el partido siguiente ya
 * tiene resultado cargado, se rechaza con 409 y la lista de bloqueadores —
 * hay que deshacer ese resultado primero (`DELETE /matches/:id/result`). Y si
 * el torneo ya estaba cerrado, hace falta `confirmReopen: true` explícito,
 * porque reabrirlo mueve puntos del ranking global.
 */
export const setMatchResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { scores, confirmReopen } = req.body as SetResultBody;

    const match = await Match.findById(req.params.id);
    if (!match) {
      return void res.status(404).json({ message: "Partido no encontrado" });
    }
    if (match.type !== MATCH_TYPES.TOURNAMENT || !match.tournament) {
      return void res.status(400).json({ message: "Este endpoint es solo para partidos de torneo" });
    }
    if (match.teams.length !== 2) {
      return void res.status(400).json({ message: "El partido todavía no tiene los 2 equipos asignados" });
    }

    const tournament = await Tournament.findById(match.tournament);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }

    if (!Array.isArray(scores) || scores.length !== 2) {
      return void res.status(400).json({ message: "Se requieren los 2 marcadores" });
    }
    for (const s of scores) {
      if (typeof s.score !== "number" || !Number.isInteger(s.score) || s.score < 0 || s.score > MAX_SCORE) {
        return void res.status(400).json({
          message: `Score inválido (entero entre 0 y ${MAX_SCORE})`
        });
      }
      if (!match.teams.some((t) => t.teamId.toString() === s.teamId)) {
        return void res.status(400).json({
          message: "teamId no pertenece a este partido",
          error: { teamId: s.teamId }
        });
      }
    }
    const outcome = trucoOutcome(scores);
    if (!outcome) {
      return void res.status(400).json({
        message: `Para cargar el resultado, uno de los dos equipos (y solo uno) tiene que llegar a ${MAX_SCORE} puntos`
      });
    }

    const wasFinished = match.status === MATCH_STATUS.FINISHED;
    const winnerChanged = match.winner?.toString() !== outcome.winnerId;

    // Editar solo el marcador de un partido ya finalizado, sin tocar quién
    // ganó: no mueve nada del cuadro, así que no pasa por ninguna de las
    // guardas de abajo.
    if (wasFinished && !winnerChanged) {
      for (const s of scores) {
        const team = match.teams.find((t) => t.teamId.toString() === s.teamId)!;
        team.score = s.score;
      }
      await match.save();
      return void res.status(200).json({ message: "Marcador actualizado", match });
    }

    if (wasFinished) {
      const blockers = await downstreamBlockers(match);
      if (blockers.length > 0) {
        return void res.status(409).json({
          message:
            "No se puede corregir: el partido siguiente ya tiene resultado cargado. Deshacé ese resultado primero.",
          blockers: blockersPayload(blockers)
        });
      }
    }

    const resyncMode = tournament.status === "completed";
    if (resyncMode && !confirmReopen) {
      const affectedPlayers = tournament.playerStats.filter((s) => !s.isGuest && s.playerId).length;
      return void res.status(409).json({
        message: "El torneo ya está cerrado. Corregir este resultado va a reabrirlo y recalcular el ranking.",
        requiresConfirmation: true,
        impact: { affectedPlayers }
      });
    }

    // A partir de acá el partido queda finalizado sí o sí: `detachDownstream`
    // necesita el ganador/perdedor VIEJOS (no bloqueado arriba implica que
    // ninguno de los dos destinos está terminado, así que esto nunca dispara
    // la rama recursiva de la cascada del lado del organizador).
    if (wasFinished) {
      await detachDownstream(match);
    }

    for (const s of scores) {
      const team = match.teams.find((t) => t.teamId.toString() === s.teamId)!;
      team.score = s.score;
    }
    match.winner = new mongoose.Types.ObjectId(outcome.winnerId);
    match.losingTeam = new mongoose.Types.ObjectId(outcome.loserId);
    match.status = MATCH_STATUS.FINISHED;
    await match.save();

    await advanceWinnerLoser(match);
    await maybeCloseTournament(match.tournament as mongoose.Types.ObjectId, match.bracketSlot, resyncMode ? "resync" : "close");

    res.status(200).json({
      message: wasFinished ? "Resultado corregido" : "Resultado cargado",
      match
    });
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al cargar el resultado", error: { message: err.message } });
  }
};

/**
 * Deshace el resultado de un partido: lo devuelve a `in_progress`, limpia
 * ganador/perdedor/marcador y desprende a los equipos que había empujado al
 * partido siguiente. Es el otro lado de la corrección bloqueada en
 * `setMatchResult`: si un partido posterior ya tiene resultado y por eso no
 * se puede corregir el de más atrás, esto es lo que hay que llamar primero —
 * de a un partido por vez, viendo qué se deshace en cada paso.
 */
export const clearMatchResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const confirmReopen = req.body?.confirmReopen === true || req.query.confirmReopen === "true";

    const match = await Match.findById(req.params.id);
    if (!match) {
      return void res.status(404).json({ message: "Partido no encontrado" });
    }
    if (match.type !== MATCH_TYPES.TOURNAMENT || !match.tournament) {
      return void res.status(400).json({ message: "Este endpoint es solo para partidos de torneo" });
    }
    if (match.status !== MATCH_STATUS.FINISHED) {
      return void res.status(409).json({ message: "Este partido no está finalizado" });
    }

    const tournament = await Tournament.findById(match.tournament);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }

    const blockers = await downstreamBlockers(match);
    if (blockers.length > 0) {
      return void res.status(409).json({
        message:
          "No se puede deshacer: el partido siguiente ya tiene resultado cargado. Deshacé ese resultado primero.",
        blockers: blockersPayload(blockers)
      });
    }

    const resyncMode = tournament.status === "completed";
    if (resyncMode && !confirmReopen) {
      const affectedPlayers = tournament.playerStats.filter((s) => !s.isGuest && s.playerId).length;
      return void res.status(409).json({
        message: "El torneo ya está cerrado. Deshacer este resultado va a reabrirlo y recalcular el ranking.",
        requiresConfirmation: true,
        impact: { affectedPlayers }
      });
    }

    await detachDownstream(match);

    match.winner = undefined;
    match.losingTeam = undefined;
    for (const t of match.teams) t.score = 0;
    match.status = MATCH_STATUS.IN_PROGRESS;
    await match.save();

    if (resyncMode) {
      await revertTournamentPoints(tournament);
      tournament.playerStats = [];
      tournament.status = "in_progress";
      await tournament.save();
    }

    res.status(200).json({ message: "Resultado deshecho", match });
  } catch (error) {
    const err = error as { message?: string };
    res
      .status(400)
      .json({ message: "Error al deshacer el resultado", error: { message: err.message } });
  }
};

export const getMatchesByTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournament: tournamentId });

    const formattedMatches = matches.map((match) => ({
      _id: match._id,
      type: match.type,
      status: match.status,
      tournament: match.tournament,
      teams: match.teams,
      winner: match.winner,
      losingTeam: match.losingTeam,
      bracketSlot: match.bracketSlot,
      feedsWinnerTo: match.feedsWinnerTo,
      feedsLoserTo: match.feedsLoserTo,
      ...(match.type === "tournament" && match.phase ? { phase: match.phase } : {})
    }));

    res.json(formattedMatches);
  } catch (error) {
    console.error("Error al obtener partidos del torneo:", error);
    res.status(500).json({ message: "Error al obtener los partidos del torneo" });
  }
};
