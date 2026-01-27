import { Request, Response } from "express";
import User from "../models/User";
import Match from "../models/Match";

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('username _id');
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('username _id');
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ message: "Se requiere un término de búsqueda" });
      return;
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    }).select('username _id');

    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}; 

export const getUserMatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;

    const matches = await Match.find({
      "teams.players.playerId": id
    })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

    if (!matches || matches.length === 0) {
      res.status(404).json({ message: "No se encontraron partidos para este usuario" });
      return;
    }
    res.status(200).json(matches);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener stats del jugador', error: error.message })
  }
}

export const getUserMatchesLength = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const matchCount = await Match.countDocuments({
      "teams.players.playerId": id
    });

    res.status(200).json({ totalMatches: matchCount });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener total de partidos del jugador', error: error.message });
  }
};

export const getUserNameById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('username'); 
  
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json({ username: user.username });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener nombre del usuario', error: error.message });
  }
};