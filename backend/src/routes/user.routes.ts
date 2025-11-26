import express from "express";
import { getAllUsers, getUserById, searchUsers, getUserMatches } from "../controllers/user.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/", authMiddleware, getAllUsers);

router.get("/search", authMiddleware, searchUsers);

router.get("/:id", authMiddleware, getUserById);

router.get("/:id/stats", authMiddleware, getUserMatches);


export default router; 