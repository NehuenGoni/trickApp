import { Request, Response } from "express";
import Match from "../models/Match";
import Tournament from "../models/Tournament";
import { FRIENDLY_MATCHES_ID, MATCH_TYPES, MATCH_STATUS } from "../config/constants";

interface AuthRequest extends Request {
    user?: string;
  }

export const createMatch = async (req: AuthRequest, res: Response) => {
  try {
    const { tournament, teams, type = MATCH_TYPES.FRIENDLY } = req.body;

    if (!Array.isArray(teams)) {
      res.status(400).json({ 
        message: "El campo 'teams' debe ser un array",
        error: { received: teams }
      });
      return 
    }

    const isValidTeam = teams.every(team => 
      team && 
      typeof team === 'object' && 
      'teamId' in team && 
      'score' in team
    );

    if (!isValidTeam) {
      res.status(400).json({ 
        message: "Cada equipo debe tener 'teamId' y 'score'",
        error: { received: teams }
      });
      return 
    }

    let matchData: any = {
      teams,
      status: MATCH_STATUS.IN_PROGRESS,
      type
    };

    if (type === MATCH_TYPES.TOURNAMENT) {
      if (!tournament) {
        res.status(400).json({ 
          message: "Se requiere un torneo para partidos de tipo torneo",
          error: { type, tournament }
        });
        return 
      }

      const tournamentData = await Tournament.findById(tournament);
      if (!tournamentData) {
        res.status(404).json({ 
          message: "Torneo no encontrado",
          error: { tournamentId: tournament }
        });
        return 
      }

      matchData.tournament = tournament;
    } else {
      matchData.tournament = FRIENDLY_MATCHES_ID;
    }

    const match = new Match(matchData);
    await match.save();
    
    res.status(201).json(match);
  } catch (error: any) {
    res.status(400).json({ 
      message: "Error al crear el partido", 
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
};

export const getMatches = async (req: Request, res: Response) => {
  try {
    const matches = await Match.find();

    for (const match of matches) {
      if (match.type === MATCH_TYPES.TOURNAMENT) {
        await match.populate("tournament");
      }
      await match.populate("teams.teamId");
    }
    
    res.status(200).json(matches);
  } catch (error: any) {
    res.status(400).json({ 
      message: "Error al obtener los partidos", 
      error: {
        message: error.message
      }
    });
  }
};

export const getInProgressMatches = async (req: Request, res: Response) => {
  try {
    const matches = await Match.find({ status: MATCH_STATUS.IN_PROGRESS })
      .sort({ createdAt: -1 })
      
    for (const match of matches) {
      if (match.type === MATCH_TYPES.TOURNAMENT) {
        await match.populate("tournament");
      }
      await match.populate("teams.teamId");
    }
    
    res.status(200).json(matches);
  } catch (error: any) {
    res.status(400).json({ 
      message: "Error al obtener los partidos en curso", 
      error: {
        message: error.message
      }
    });
  }
};

export const getMatchById = async (req: Request, res: Response) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({ 
        message: "ID de partido inválido",
        error: { id: req.params.id }
      });
      return 
    }

    const match = await Match.findById(req.params.id);

    if (!match) {
      res.status(404).json({ 
        message: "Partido no encontrado",
        error: { id: req.params.id }
      });
      return 
    }

    // if (match.type === MATCH_TYPES.TOURNAMENT) {
    //   await match.populate("tournament");
    // }
    // await match.populate("teams.teamId");

    res.status(200).json(match);
  } catch (error: any) {
    res.status(400).json({ 
      message: "Error al obtener el partido",
      error: {
        message: error.message
      }
    });
  }
};

export const updateMatch = async (req: Request, res: Response) => {
  try {
    const { teams, winner, status } = req.body;

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { teams, winner, status },
      { new: true }
    );

    if (!match) {
      res.status(404).json({ message: "Partido no encontrado" });
      return 
    }

    res.status(200).json(match);
  } catch (error: any) {
    res.status(400).json({ 
      message: "Error al actualizar el partido", 
      error: {
        message: error.message
      }
    });
  }
};

export const deleteMatch = async (req: Request, res: Response) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) {
      res.status(404).json({ message: "Partido no encontrado" });
      return 
    }
    res.status(200).json({ message: "Partido eliminado correctamente" });
  } catch (error: any) {
    res.status(400).json({ 
      message: "Error al eliminar el partido", 
      error: {
        message: error.message
      }
    });
  }
};

export const getMatchesByTournament = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    
    const matches = await Match.find({ tournament: tournamentId })
      .populate('team1.teamId')
      .populate('team2.teamId');

    res.json(matches);
  } catch (error) {
    console.error('Error al obtener partidos del torneo:', error);
    res.status(500).json({ message: 'Error al obtener los partidos del torneo' });
  }
};
