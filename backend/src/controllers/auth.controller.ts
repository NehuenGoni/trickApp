import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import dotenv from "dotenv";

dotenv.config();

interface AuthRequest extends Request {
  user?: string;
}

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, email, password } = req.body;
  
      const userExists = await User.findOne({ email });
      if (userExists) {
        res.status(400).json({ message: "Usuario ya existe" });
        return;
      }
  
      const newUser = new User({
        username,
        email,
        password,
      });
  
      await newUser.save();
      res.status(201).json({ message: "Usuario registrado con éxito", user: newUser });
    } catch (err) {
      res.status(500).json({ message: "Error al registrar el usuario", error: err });
    }
  };
 

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      res.status(400).json({ message: "Usuario no encontrado" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      res.status(400).json({ message: "Contraseña incorrecta" });
      return;
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    res.status(200).json({ message: "Login exitoso", token, userId: user._id  });
  } catch (err) {
    res.status(500).json({ message: "Error en el login", error: err });
  }
};

export const profileData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
      const user = await User.findById(req.user).select("-password")
      if (!user) {
          res.status(404).json({ message: "Usuario no encontrado" });
          return
      }
      res.json({ user });
  } catch (error) {
      res.status(500).json({ message: "Error al obtener el perfil", error });
  }
}

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user);
      if (!user) {
          res.status(404).json({ message: "Usuario no encontrado" });
          return 
      }

      if (username && !newPassword) {
          user.username = username;
          await user.save();
          res.json({ message: "Nombre de usuario actualizado correctamente" });
          return 
      }

      if (newPassword) {
          const isMatch = await bcrypt.compare(currentPassword, user.password);
          if (!isMatch) {
              res.status(400).json({ message: "La contraseña actual es incorrecta" });
              return 
          }
          user.password = newPassword;
          if (username) user.username = username;
          await user.save();
          res.json({ message: "Perfil actualizado correctamente" });
          return 
      }
  } catch (error) {
      res.status(500).json({ message: "Error al actualizar el perfil", error });
  }
}