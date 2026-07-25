import express, {Request, Response} from "express";
import {
  registerUser,
  loginUser,
  profileData,
  updateProfile,
  forgotPassword,
  verifyResetToken,
  resetPassword
} from "../controllers/auth.controller"
import authMiddleware from "../middlewares/authMiddleware";
import User from "../models/User";
import bcrypt from "bcryptjs";
import { get } from "http";

const router = express.Router();


router.post("/register", registerUser);
router.post("/login", loginUser);

// Recuperación de contraseña (públicas: el usuario no puede iniciar sesión)
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", verifyResetToken);
router.post("/reset-password/:token", resetPassword);

router.get("/profile", authMiddleware, profileData);
router.put("/profile", authMiddleware, updateProfile);

export default router;

