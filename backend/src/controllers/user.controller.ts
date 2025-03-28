import { Request, Response } from "express";
import User from "../models/User";

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