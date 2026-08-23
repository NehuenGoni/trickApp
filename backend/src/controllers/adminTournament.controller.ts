import { Request, Response } from "express";
import mongoose from "mongoose";
import TournamentModel, {
  IIndividualSignup
} from "../models/Tournament";
import Match, { IMatch } from "../models/Match";
import User from "../models/User";
import {
  TEAM_FORMATION_MODES,
  FORMAT_TEAM_SIZE,
  TOURNAMENT_TEAMS_COUNT,
  MATCH_STATUS,
  MAX_SCORE
} from "../config/constants";
import {
  computePlayerStats,
  awardTournamentPoints,
  revertTournamentPoints,
  deleteTournamentCascade,
  notifyTournamentClosedFromStats
} from "./tournament.controller";
import { applyTournamentUpdate } from "../services/tournamentUpdate";
import { withTransaction } from "../utils/withTransaction";

interface AuthRequest extends Request {
  user?: string;
}

const TOURNAMENT_STATUSES = ["upcoming", "in_progress", "completed"] as const;

export const listTournaments = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const search = (req.query.search as string)?.trim();
    const status = req.query.status as string | undefined;

    const filter: Record<string, unknown> = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: escaped, $options: "i" };
    }
    if (status && (TOURNAMENT_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }
    const league = req.query.league as string | undefined;
    if (league && mongoose.isValidObjectId(league)) {
      filter.league = league;
    }

    const [tournaments, total] = await Promise.all([
      TournamentModel.find(filter)
        .populate("createdBy", "username email")
        .populate("league", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      TournamentModel.countDocuments(filter)
    ]);

    res.status(200).json({
      tournaments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al listar torneos", error: error.message });
  }
};

/**
 * Edición sin las restricciones de creador/estado del endpoint público.
 * El estado no se cambia acá: para eso están /reset y /close, que además
 * ajustan partidos y puntos.
 */
export const updateTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de torneo inválido" });
    }

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }

    const result = await applyTournamentUpdate(tournament, req.body, req.authUser);
    if ("error" in result) {
      // Campos extra (reason/plan/limit/current/canUpgrade) solo están
      // presentes en el 402 de cupo de liga — ver `services/leagueCapGate.ts`.
      const { error, status, ...extra } = result;
      return void res.status(status).json({ message: error, ...extra });
    }

    await tournament.save();

    res.status(200).json({
      message: result.recalculated
        ? "Torneo actualizado. Se recalcularon los puntos por el cambio de tipo."
        : "Torneo actualizado",
      tournament
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al actualizar el torneo", error: error.message });
  }
};

/**
 * Devuelve el torneo al estado de inscripciones: borra los partidos generados,
 * limpia el ranking y descuenta del ranking global los puntos ya otorgados.
 */
export const resetTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { unmakeTeams } = req.body as { unmakeTeams?: boolean };

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de torneo inválido" });
    }

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }

    await revertTournamentPoints(tournament);

    const deleted = await Match.deleteMany({ tournament: tournament._id });

    tournament.matches = [];
    tournament.playerStats = [];
    tournament.status = "upcoming";
    tournament.draftPairOrder = undefined;

    let signupsRestored = 0;
    if (unmakeTeams) {
      if (tournament.teamFormationMode !== TEAM_FORMATION_MODES.USER_FORMED) {
        // random y creator-formed: los equipos derivados del pool (isDrawn) se
        // deshacen y sus jugadores vuelven a la lista de inscriptos; los
        // equipos cargados enteros a mano (`addGuestTeam`) se conservan.
        const drawn = tournament.teams.filter((t) => t.isDrawn);
        const restored: IIndividualSignup[] = [];
        for (const team of drawn) {
          for (const player of team.players) {
            restored.push({
              signupId: new mongoose.Types.ObjectId(),
              userId: player.playerId,
              name: player.name,
              isGuest: !!player.isGuest
            });
          }
        }
        tournament.teams = tournament.teams.filter((t) => !t.isDrawn);
        tournament.individualSignups.push(...restored);
        signupsRestored = restored.length;
      } else {
        tournament.teams = [];
      }
    }

    await tournament.save();

    res.status(200).json({
      message: `Torneo reseteado a inscripciones abiertas. Se eliminaron ${deleted.deletedCount} partido(s)${
        signupsRestored ? ` y se devolvieron ${signupsRestored} jugador(es) a la lista de inscriptos` : ""
      }.`,
      tournament
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al resetear el torneo", error: error.message });
  }
};

/** Cierra el torneo con los resultados que haya, aunque el cuadro esté incompleto. */
export const forceCloseTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de torneo inválido" });
    }

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (tournament.status === "completed" && tournament.pointsAwarded) {
      return void res.status(400).json({
        message: "El torneo ya está finalizado. Usá 'Recalcular puntos' si necesitás corregirlo."
      });
    }

    tournament.playerStats = await computePlayerStats(tournament);
    tournament.status = "completed";
    await awardTournamentPoints(tournament);
    await tournament.save();

    notifyTournamentClosedFromStats(tournament);

    res.status(200).json({
      message: `Torneo cerrado. Se repartieron puntos a ${
        tournament.playerStats.filter((s) => !s.isGuest && s.playerId).length
      } jugador(es).`,
      tournament
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al cerrar el torneo", error: error.message });
  }
};

/** Revierte los puntos otorgados y los vuelve a calcular desde los partidos. */
export const recalculateTournamentPoints = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de torneo inválido" });
    }

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }

    await revertTournamentPoints(tournament);
    tournament.playerStats = await computePlayerStats(tournament);
    await awardTournamentPoints(tournament);
    await tournament.save();

    res.status(200).json({
      message: "Puntos recalculados",
      playerStats: [...tournament.playerStats].sort((a, b) => a.position - b.position)
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al recalcular los puntos", error: error.message });
  }
};

export const deleteTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de torneo inválido" });
    }

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }

    // La cascada descuenta los puntos ya otorgados. Si el torneo pertenecía a
    // una liga, esta se corrige sola: su tabla de posiciones es derivada, no
    // hace falta ningún paso extra acá (ver deleteTournamentCascade).
    const { deletedMatches } = await withTransaction((session) =>
      deleteTournamentCascade(tournament, session)
    );

    res.status(200).json({
      message: `Torneo "${tournament.name}" eliminado junto con ${deletedMatches} partido(s).`
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al eliminar el torneo", error: error.message });
  }
};

export const getTournamentMatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de torneo inválido" });
    }
    const matches = await Match.find({ tournament: id }).sort({ createdAt: 1 });
    res.status(200).json(matches);
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener los partidos", error: error.message });
  }
};

/**
 * Deshace la propagación de un partido ya finalizado: saca los equipos que había
 * empujado a las siguientes rondas y, si esas rondas ya se habían jugado, las
 * revierte también en cascada. El cuadro tiene 3 niveles, así que la recursión
 * está acotada.
 */
const rollbackDownstream = async (match: IMatch): Promise<number> => {
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
      reverted += await rollbackDownstream(target);
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

const propagateResult = async (match: IMatch): Promise<void> => {
  if (!match.winner || !match.losingTeam) return;

  const buildTeam = (id: mongoose.Types.ObjectId) => {
    const t = match.teams.find((x) => x.teamId.toString() === id.toString());
    if (!t) return null;
    return {
      teamId: t.teamId,
      score: 0,
      players: t.players.map((p) => ({
        playerId: p.playerId,
        username: p.username,
        isGuest: !!p.isGuest
      }))
    };
  };

  const push = async (
    targetId: mongoose.Types.ObjectId | undefined,
    team: ReturnType<typeof buildTeam>
  ) => {
    if (!targetId || !team) return;
    const target = await Match.findById(targetId);
    if (!target) return;
    if (target.teams.some((t) => t.teamId.toString() === team.teamId.toString())) return;
    target.teams.push(team as unknown as typeof target.teams[number]);
    if (target.teams.length === 2 && target.status === MATCH_STATUS.PENDING) {
      target.status = MATCH_STATUS.IN_PROGRESS;
    }
    await target.save();
  };

  await push(match.feedsWinnerTo as mongoose.Types.ObjectId, buildTeam(match.winner as mongoose.Types.ObjectId));
  await push(match.feedsLoserTo as mongoose.Types.ObjectId, buildTeam(match.losingTeam as mongoose.Types.ObjectId));
};

/**
 * Corrige un partido sin importar su estado. Si cambia el ganador de un partido
 * ya finalizado, revierte el cuadro aguas abajo y vuelve a propagar; si el torneo
 * estaba cerrado, devuelve los puntos y lo reabre.
 */
export const updateMatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { scores, winner, status } = req.body as {
      scores?: Array<{ teamId: string; score: number }>;
      winner?: string | null;
      status?: string;
    };

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de partido inválido" });
    }

    const match = await Match.findById(id);
    if (!match) {
      return void res.status(404).json({ message: "Partido no encontrado" });
    }

    if (status !== undefined && !(Object.values(MATCH_STATUS) as string[]).includes(status)) {
      return void res.status(400).json({
        message: `Estado inválido (${Object.values(MATCH_STATUS).join(" | ")})`
      });
    }

    if (Array.isArray(scores)) {
      for (const s of scores) {
        if (typeof s.score !== "number" || s.score < 0 || s.score > MAX_SCORE) {
          return void res.status(400).json({
            message: `Score inválido (debe estar entre 0 y ${MAX_SCORE})`
          });
        }
        const team = match.teams.find((t) => t.teamId.toString() === s.teamId.toString());
        if (!team) {
          return void res.status(400).json({
            message: "teamId no pertenece a este partido",
            error: { teamId: s.teamId }
          });
        }
        team.score = s.score;
      }
    }

    // Snapshot previo a mutar el partido: es lo que necesita el rollback del cuadro.
    const previous = {
      winner: match.winner,
      losingTeam: match.losingTeam,
      feedsWinnerTo: match.feedsWinnerTo,
      feedsLoserTo: match.feedsLoserTo
    } as IMatch;
    const previousWinner = match.winner?.toString();
    const previousStatus = match.status;
    const nextStatus = (status ?? match.status) as typeof match.status;

    if (nextStatus === MATCH_STATUS.FINISHED) {
      const winnerId = winner ?? previousWinner;
      if (!winnerId) {
        return void res.status(400).json({ message: "Falta indicar el equipo ganador" });
      }
      if (!match.teams.some((t) => t.teamId.toString() === winnerId.toString())) {
        return void res.status(400).json({
          message: "El ganador debe ser uno de los equipos del partido"
        });
      }
      match.winner = new mongoose.Types.ObjectId(winnerId);
      const loser = match.teams.find((t) => t.teamId.toString() !== winnerId.toString());
      match.losingTeam = loser ? loser.teamId : undefined;
    }

    const winnerChanged =
      previousWinner !== undefined && match.winner?.toString() !== previousWinner;
    const unfinished =
      previousStatus === MATCH_STATUS.FINISHED && nextStatus !== MATCH_STATUS.FINISHED;

    let revertedMatches = 0;
    let reopenedTournament = false;

    if (match.tournament && (winnerChanged || unfinished)) {
      revertedMatches = await rollbackDownstream(previous);

      const tournament = await TournamentModel.findById(match.tournament);
      if (tournament && (tournament.pointsAwarded || tournament.status === "completed")) {
        await revertTournamentPoints(tournament);
        tournament.playerStats = [];
        tournament.status = "in_progress";
        await tournament.save();
        reopenedTournament = true;
      }
    }

    if (unfinished) {
      match.winner = undefined;
      match.losingTeam = undefined;
    }
    match.status = nextStatus;

    await match.save();

    if (match.status === MATCH_STATUS.FINISHED && match.tournament) {
      await propagateResult(match);
    }

    const notes: string[] = [];
    if (revertedMatches > 0) {
      notes.push(`se revirtieron ${revertedMatches} partido(s) posteriores del cuadro`);
    }
    if (reopenedTournament) {
      notes.push("el torneo se reabrió y se descontaron los puntos otorgados");
    }

    res.status(200).json({
      message: notes.length
        ? `Partido actualizado: ${notes.join(" y ")}.`
        : "Partido actualizado",
      match
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al actualizar el partido", error: error.message });
  }
};

export const deleteMatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de partido inválido" });
    }

    const match = await Match.findById(id);
    if (!match) {
      return void res.status(404).json({ message: "Partido no encontrado" });
    }

    if (match.tournament) {
      await TournamentModel.updateOne(
        { _id: match.tournament },
        { $pull: { matches: match._id } }
      );
    }

    await match.deleteOne();
    res.status(200).json({ message: "Partido eliminado" });
  } catch (error: any) {
    res.status(500).json({ message: "Error al eliminar el partido", error: error.message });
  }
};

export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      totalUsers,
      newUsers,
      totalTournaments,
      upcoming,
      inProgress,
      completed,
      totalMatches,
      liveMatches,
      topPlayers,
      recentTournaments
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: since } }),
      TournamentModel.countDocuments(),
      TournamentModel.countDocuments({ status: "upcoming" }),
      TournamentModel.countDocuments({ status: "in_progress" }),
      TournamentModel.countDocuments({ status: "completed" }),
      Match.countDocuments(),
      Match.countDocuments({ status: MATCH_STATUS.IN_PROGRESS }),
      User.find()
        .select("username totalPoints")
        .sort({ totalPoints: -1 })
        .limit(5),
      TournamentModel.find()
        .select("name status startDate createdAt teams individualSignups logo")
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    res.status(200).json({
      users: { total: totalUsers, newLast30Days: newUsers },
      tournaments: {
        total: totalTournaments,
        upcoming,
        inProgress,
        completed
      },
      matches: { total: totalMatches, inProgress: liveMatches },
      topPlayers,
      recentTournaments,
      config: {
        teamsPerTournament: TOURNAMENT_TEAMS_COUNT,
        teamSize: FORMAT_TEAM_SIZE
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener las métricas", error: error.message });
  }
};
