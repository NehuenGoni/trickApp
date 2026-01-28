import express from "express";
import { getAllUsers, getUserById, searchUsers, getUserMatches, getUserMatchesLength, getUserNameById } from "../controllers/user.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/", authMiddleware, getAllUsers);

router.get("/search", authMiddleware, searchUsers);

router.get("/matchesNames/:id", authMiddleware, getUserNameById);

router.get("/:id/stats", authMiddleware, getUserMatches);

router.get("/:id/matches-length", authMiddleware, getUserMatchesLength);

router.get("/:id", authMiddleware, getUserById);


export default router; 