import { Request, Response } from "express";
import Match from "../models/Match";
import Tournament from "../models/Tournament";

interface AuthRequest extends Request {
    user?: string; // Agregamos la propiedad 'user'
  }

export const createMatch = async (req: AuthRequest, res: Response) => {
  try {
    const { tournament, teams } = req.body;
    console.log("📩 Recibida petición para crear partido:", req.body);


    // Verificar si el torneo existe
    console.log(Tournament)
    const tournamentData = await Tournament.findById(tournament);
    console.log(tournament)
    if (!tournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return
    }

    const match = new Match({
      tournament: tournament,
      teams,
      status: "in_progress",
    });

    await match.save();
    console.log("🎉 Partido guardado en la colección 'matches':", match);
    res.status(201).json(match);
  } catch (error) {
    res.status(400).json({ message: "Error al crear el partido", error });
  }
};

// Obtener todos los partidos
export const getMatches = async (req: Request, res: Response) => {
  try {
    const matches = await Match.find().populate("tournament").populate("teams.teamId");
    res.status(200).json(matches);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener los partidos", error });
  }
};

// Obtener un partido por ID
export const getMatchById = async (req: Request, res: Response) => {
  try {
    const match = await Match.findById(req.params.id).populate("tournament").populate("teams.teamId");
    if (!match) {
      res.status(404).json({ message: "Partido no encontrado" });
      return
    }
    res.status(200).json(match);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener el partido", error });
  }
};

// Actualizar un partido (actualizar puntajes, definir ganador, etc.)
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
  } catch (error) {
    res.status(400).json({ message: "Error al actualizar el partido", error });
  }
};

// Eliminar un partido
export const deleteMatch = async (req: Request, res: Response) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) {
      res.status(404).json({ message: "Partido no encontrado" });
      return 
    }
    res.status(200).json({ message: "Partido eliminado correctamente" });
  } catch (error) {
    res.status(400).json({ message: "Error al eliminar el partido", error });
  }
};
