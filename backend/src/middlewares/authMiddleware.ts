import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

interface TokenPayload {
  userId: string;
}

const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ message: "Acceso no autorizado" });
    return 
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    
    (req as Request & { user: string }).user = decoded.userId; 

    next();
  } catch (err) {
    res.status(400).json({ message: "Token inválido" });
    return
  }
};

export default authMiddleware;
