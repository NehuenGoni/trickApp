import { Request, Response } from "express";
import League from "../models/League";
import Tournament from "../models/Tournament";
import Match from "../models/Match";

interface AuthRequest extends Request {
  user?: string;
}

// Crear una nueva liga
export const createLeague = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, startDate, endDate } = req.body;
    const createdBy = req.user;

    const league = new League({
      name,
      description,
      startDate,
      endDate,
      createdBy,
      tournaments: [],
      userStats: []
    });

    await league.save();
    res.status(201).json(league);
  } catch (error) {
    res.status(400).json({ message: "Error al crear la liga", error });
  }
};

// Obtener todas las ligas
export const getLeagues = async (req: Request, res: Response) => {
  try {
    const leagues = await League.find()
      .populate("tournaments")
      .populate("userStats.userId", "username");
    res.status(200).json(leagues);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener las ligas", error });
  }
};

// Obtener una liga específica
export const getLeagueById = async (req: Request, res: Response) => {
  try {
    const league = await League.findById(req.params.id)
      .populate("tournaments")
      .populate("userStats.userId", "username");
    
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return 
    }
    
    res.status(200).json(league);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener la liga", error });
  }
};

// Agregar un torneo a una liga
export const addTournamentToLeague = async (req: Request, res: Response) => {
  try {
    const { leagueId, tournamentId } = req.body;

    const league = await League.findById(leagueId);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return 
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return 
    }

    if (league.tournaments.includes(tournamentId)) {
      res.status(400).json({ message: "El torneo ya está en la liga" });
      return 
    }

    league.tournaments.push(tournamentId);
    await league.save();

    res.status(200).json({ message: "Torneo agregado a la liga", league });
  } catch (error) {
    res.status(400).json({ message: "Error al agregar el torneo a la liga", error });
  }
};

// Actualizar puntos de un usuario en una liga
export const updateUserLeaguePoints = async (req: Request, res: Response) => {
  try {
    const { leagueId, userId, points, wins = 0, losses = 0 } = req.body;

    const league = await League.findById(leagueId);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return 
    }

    const userStats = league.userStats.find(
      stats => stats.userId.toString() === userId
    );

    if (userStats) {
      // Actualizar estadísticas existentes
      userStats.points += points;
      userStats.wins += wins;
      userStats.losses += losses;
      userStats.tournamentsPlayed = Math.max(userStats.tournamentsPlayed, league.tournaments.length);
    } else {
      // Crear nuevas estadísticas para el usuario
      league.userStats.push({
        userId,
        points,
        wins,
        losses,
        tournamentsPlayed: 1
      });
    }

    await league.save();
    res.status(200).json({ message: "Puntos actualizados", league });
  } catch (error) {
    res.status(400).json({ message: "Error al actualizar los puntos", error });
  }
};

// Obtener tabla de posiciones de una liga
export const getLeagueStandings = async (req: Request, res: Response) => {
  try {
    const league = await League.findById(req.params.id)
      .populate("userStats.userId", "username");
    
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return 
    }

    const standings = league.userStats
      .sort((a, b) => b.points - a.points)
      .map((stats, index) => ({
        position: index + 1,
        username: (stats.userId as any).username,
        points: stats.points,
        tournamentsPlayed: stats.tournamentsPlayed,
        wins: stats.wins,
        losses: stats.losses
      }));

    res.status(200).json(standings);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener la tabla de posiciones", error });
  }
}; 