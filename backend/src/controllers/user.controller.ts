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
    const matches = await Match.find({
      "teams.players.playerId": id
  })

  if (!matches || matches.length === 0) {
    res.status(404).json({ message: "No se encontraron partidos para este usuario" });
    return;
  }
  res.status(200).json(matches);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener stats del jugador', error: error.message })
  }
}