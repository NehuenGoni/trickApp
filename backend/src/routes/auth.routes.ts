import express, {Request, Response} from "express";
import { registerUser, loginUser, profileData, updateProfile } from "../controllers/auth.controller"
import authMiddleware from "../middlewares/authMiddleware";
import User from "../models/User";
import bcrypt from "bcryptjs";
import { get } from "http";

const router = express.Router();


router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/profile", authMiddleware, profileData);
router.put("/profile", authMiddleware, updateProfile);

export default router;

