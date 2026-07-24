import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User, { UserRole } from "../models/User";

dotenv.config();

interface TokenPayload {
  userId: string;
  iat?: number;
}

const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ message: "Acceso no autorizado" });
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

    const user = await User.findById(decoded.userId).select("role passwordChangedAt");
    if (!user) {
      res.status(401).json({ message: "Token inválido" });
      return;
    }

    // Un cambio de contraseña (propio o hecho por un admin) invalida los tokens previos.
    if (
      user.passwordChangedAt &&
      decoded.iat &&
      decoded.iat * 1000 < user.passwordChangedAt.getTime()
    ) {
      res.status(401).json({ message: "Token inválido" });
      return;
    }

    (req as Request & { user: string }).user = decoded.userId;
    req.authUser = { id: decoded.userId, role: user.role as UserRole };

    next();
  } catch (err) {
    res.status(400).json({ message: "Token inválido" });
    return
  }
};

export default authMiddleware;
