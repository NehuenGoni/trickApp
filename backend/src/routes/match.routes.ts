import express from "express";
import { createMatch, updateMatch, getMatches, getMatchById, deleteMatch } from "../controllers/match.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createMatch);
router.put("/:id", authMiddleware, updateMatch);

router.get("/", getMatches);
router.get("/:id", getMatchById);
router.delete("/:id", deleteMatch);

export default router;
