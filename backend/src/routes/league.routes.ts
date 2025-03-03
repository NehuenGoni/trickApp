import express from "express";
import {
  createLeague,
  getLeagues,
  getLeagueById,
  addTournamentToLeague,
  updateUserLeaguePoints,
  getLeagueStandings
} from "../controllers/league.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createLeague);
router.get("/", getLeagues);
router.get("/:id", getLeagueById);

router.post("/add-tournament", authMiddleware, addTournamentToLeague);
router.post("/update-points", authMiddleware, updateUserLeaguePoints);
router.get("/:id/standings", getLeagueStandings);

export default router; 