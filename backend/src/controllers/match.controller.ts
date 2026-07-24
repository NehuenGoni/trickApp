import { Request, Response } from "express";
import mongoose from "mongoose";
import Match, { IMatch, IMatchTeam } from "../models/Match";
import Tournament from "../models/Tournament";
import {
  MATCH_TYPES,
  MATCH_STATUS,
  MAX_SCORE,
  BRACKET_SLOTS
} from "../config/constants";
import { closeTournament } from "./tournament.controller";

interface AuthRequest extends Request {
  user?: string;
}

const TERMINAL_SLOTS = new Set<string>([
  BRACKET_SLOTS.FG,
  BRACKET_SLOTS.FS,
  BRACKET_SLOTS.M34,
  BRACKET_SLOTS.M78
]);

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

const advanceWinnerLoser = async (
  current: IMatch
): Promise<void> => {
  if (!current.winner || !current.losingTeam) return;

  const enrichTeam = (id: mongoose.Types.ObjectId): IMatchTeam | null => {
    const t = current.teams.find((x) => x.teamId.toString() === id.toString());
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

  const winnerTeam = enrichTeam(current.winner as mongoose.Types.ObjectId);
  const loserTeam = enrichTeam(current.losingTeam as mongoose.Types.ObjectId);

  const propagate = async (
    targetId: mongoose.Types.ObjectId | undefined,
    team: IMatchTeam | null
  ) => {
    if (!targetId || !team) return;
    const target = await Match.findById(targetId);
    if (!target) return;
    const already = target.teams.some(
      (t) => t.teamId.toString() === team.teamId.toString()
    );
    if (already) return;
    target.teams.push(team);
    if (target.teams.length === 2 && target.status === MATCH_STATUS.PENDING) {
      target.status = MATCH_STATUS.IN_PROGRESS;
    }
    await target.save();
  };

  await propagate(current.feedsWinnerTo as mongoose.Types.ObjectId, winnerTeam);
  await propagate(current.feedsLoserTo as mongoose.Types.ObjectId, loserTeam);
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

      if (match.tournament && match.bracketSlot && TERMINAL_SLOTS.has(match.bracketSlot)) {
        const remaining = await Match.countDocuments({
          tournament: match.tournament,
          bracketSlot: { $in: Array.from(TERMINAL_SLOTS) },
          status: { $ne: MATCH_STATUS.FINISHED }
        });
        if (remaining === 0) {
          await closeTournament(match.tournament as mongoose.Types.ObjectId);
        }
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
