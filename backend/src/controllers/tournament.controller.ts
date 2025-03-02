import { Request, Response } from "express";
import User from '../models/User'
import mongoose from "mongoose"
import TournamentModel from "../models/Tournament";

interface AuthRequest extends Request {
    user?: string; // Agregamos la propiedad 'user'
  }
  
// Crear torneo
export const createTournament = async (req: AuthRequest, res: Response) => {
  const { name, startDate, endDate, description, players } = req.body;
  const createdBy = req.user;
  
  try {
    const tournament = new TournamentModel({
      name,
      startDate,
      endDate,
      description,
      players,
      createdBy,
    });
    await tournament.save();
    res.status(201).json(tournament);
  } catch (error) {
    res.status(400).json({ message: "Error al crear el torneo", error });
  }
};

export const getTournaments = async (req: Request, res: Response) => {
  try {
    const tournaments = await TournamentModel.find();
    res.status(200).json(tournaments);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener los torneos", error });
  }
};

export const getTournamentById = async (req: Request, res: Response) => {
  try {
    const tournament = await TournamentModel.findById(req.params.id);
    if (!tournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return
    }
    res.status(200).json(tournament);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener el torneo", error });
  }
};

export const updateTournament = async (req: Request, res: Response) => {
  try {
    const updatedTournament = await TournamentModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    console.log(req.params.id);
    if (!updatedTournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return
    }
    res.status(200).json(updatedTournament);
  } catch (error) {
    res.status(400).json({ message: "Error al actualizar el torneo", error });
  }
};

export const deleteTournament = async (req: Request, res: Response) => {
  try {
    const deletedTournament = await TournamentModel.findByIdAndDelete(req.params.id);
    if (!deletedTournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return
    }
    res.status(200).json({ message: "Torneo eliminado con éxito" });
  } catch (error) {
    res.status(400).json({ message: "Error al eliminar el torneo", error });
  }
};

// Agregar un jugador a un torneo
export const addPlayerToTournament = async (req: Request, res: Response) => {
    try {
      const { tournamentId, playerId } = req.body;
  
      // Verificar si el torneo existe
      const tournament = await TournamentModel.findById(tournamentId);
      if (!tournament) {
        return res.status(404).json({ message: "Torneo no encontrado" });
      }
  
      // Verificar si el usuario existe
      const player = await User.findById(playerId);
      if (!player) {
        return res.status(404).json({ message: "Jugador no encontrado" });
      }
  
      // Verificar si el jugador ya está en el torneo
      if (tournament.teams.includes(playerId)) {
        return res.status(400).json({ message: "El jugador ya está en el torneo" });
      }
  
      // Agregar el jugador
      tournament.teams.push(playerId);
      await tournament.save();
  
      res.status(200).json({ message: "Jugador agregado al torneo", tournament });
    } catch (error) {
      res.status(500).json({ message: "Error al agregar jugador", error });
    }
  };


// Crear un equipo en un torneo
export const createTeamInTournament = async (req: Request, res: Response) => {
    try {
      const { tournamentId, playerIds } = req.body;
  
      // Verificar si el torneo existe
      const tournament = await TournamentModel.findById(tournamentId);
      if (!tournament) {
        res.status(404).json({ message: "Torneo no encontrado" });
        return 
      }
  
      // Verificar que los jugadores existan
      const players = await User.find({ _id: { $in: playerIds } });
      if (players.length !== playerIds.length) {
        res.status(400).json({ message: "Uno o más jugadores no existen" });
        return 
      }
  
      // Crear el equipo
      const newTeam = {
        teamId: new mongoose.Types.ObjectId(),
        players: playerIds.map((id: string) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
              throw new Error("Invalid player ID");
            }
            return new mongoose.Types.ObjectId(id);
          }),
      };
  
      tournament.teams.push(newTeam);
      await tournament.save();
  
      res.status(201).json({ message: "Equipo creado en el torneo", tournament });
    } catch (error) {
      res.status(500).json({ message: "Error al crear equipo", error });
    }
  };
  
  // Modificar un equipo dentro de un torneo
  export const updateTeam = async (req: Request, res: Response) => {
    try {
      const { tournamentId, teamId } = req.params;
      const { players } = req.body; // Nuevos jugadores del equipo
  
      const tournament = await TournamentModel.findById(tournamentId);
      if (!tournament) {
        res.status(404).json({ message: "Torneo no encontrado." });
        return 
      }
  
      const teamIndex = tournament.teams.findIndex(team => team.teamId.toString() === teamId);
      if (teamIndex === -1) {
        res.status(404).json({ message: "Equipo no encontrado." });
        return
      }
  
      tournament.teams[teamIndex].players = players;
      await tournament.save();
  
      res.status(200).json({ message: "Equipo actualizado correctamente.", team: tournament.teams[teamIndex] });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar el equipo", error });
    }
  };
  
  // Eliminar un equipo de un torneo
  export const removeTeam = async (req: Request, res: Response) => {
    try {
      const { tournamentId, teamId } = req.params;
  
      const tournament = await TournamentModel.findById(tournamentId);
      if (!tournament) {
         res.status(404).json({ message: "Torneo no encontrado." });
         return
        }
  
      tournament.teams = tournament.teams.filter(team => team.teamId.toString() !== teamId);
      await tournament.save();
  
      res.status(200).json({ message: "Equipo eliminado correctamente." });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar el equipo", error });
    }
  };