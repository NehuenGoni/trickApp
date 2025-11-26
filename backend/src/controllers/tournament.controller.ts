import { Request, Response } from "express";
import User from '../models/User'
import mongoose from "mongoose"
import TournamentModel from "../models/Tournament";

interface AuthRequest extends Request {
    user?: string;
  }
  
export const createTournament = async (req: AuthRequest, res: Response) => {
  const { name, startDate, description, players } = req.body;
  const createdBy = req.user;
  
  try {
    const tournament = new TournamentModel({
      name,
      startDate,
      description,
      players,
      createdBy,
      status: 'upcoming'
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


export const createTeamInTournament = async (req: Request, res: Response) => {
    try {
      const { tournamentId } = req.params;
      const { name, members } = req.body;
  
      // verify tournament exists
      const tournament = await TournamentModel.findById(tournamentId);
      if (!tournament) {
        res.status(404).json({ message: "Torneo no encontrado" });
        return 
      }
  
      // Create new team
      const newTeam = {
        teamId: new mongoose.Types.ObjectId(),
        name,
        players: members.map((member: any) => ({
          _id: new mongoose.Types.ObjectId(),
          playerId: member.playerId,           
          name: member.name,
          isGuest: member.isGuest ?? false
        }))
      };
  
      tournament.teams.push(newTeam);
      await tournament.save();
  
      res.status(201).json({ message: "Equipo creado en el torneo", team: newTeam });
    } catch (error) {
      res.status(500).json({ message: "Error al crear equipo", error });
    }
  };
  

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