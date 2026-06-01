import express from "express";
import {
  createTournament,
  getTournaments,
  getOpenTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  createTeamInTournament,
  updateTeam,
  removeTeam,
  startTournament,
  registerToTournament,
  unregisterFromTournament,
  addGuestTeam,
  getTournamentLeaderboard,
  creatorAddSignup,
  creatorRemoveSignup
} from "../controllers/tournament.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createTournament);
router.get("/", getTournaments);
router.get("/open", getOpenTournaments);
router.get("/:id", getTournamentById);
router.get("/:id/leaderboard", getTournamentLeaderboard);
router.put("/:id", authMiddleware, updateTournament);
router.delete("/:id", authMiddleware, deleteTournament);

router.post("/:id/start", authMiddleware, startTournament);
router.post("/:id/register", authMiddleware, registerToTournament);
router.delete("/:id/register", authMiddleware, unregisterFromTournament);
router.post("/:id/teams/guests", authMiddleware, addGuestTeam);
router.post("/:id/signups/admin", authMiddleware, creatorAddSignup);
router.delete("/:id/signups/admin/:userId", authMiddleware, creatorRemoveSignup);

router.post("/:tournamentId/teams", authMiddleware, createTeamInTournament);
router.put("/:tournamentId/teams/:teamId", authMiddleware, updateTeam);
router.delete("/:tournamentId/teams/:teamId", authMiddleware, removeTeam);

export default router;
