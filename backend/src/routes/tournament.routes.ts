import express from "express";
import {
  createTournament,
  getTournaments,
  getOpenTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  createTeamInTournament,
  removeTeam,
  drawTournament,
  startTournament,
  registerToTournament,
  unregisterFromTournament,
  addGuestTeam,
  getTournamentLeaderboard,
  creatorAddSignup,
  creatorRemoveSignup,
  replaceTournamentRoster
} from "../controllers/tournament.controller";
import { getTournamentLive } from "../controllers/live.controller";
import {
  getTournamentLogo,
  uploadTournamentLogo,
  deleteTournamentLogo
} from "../controllers/tournamentLogo.controller";
import authMiddleware from "../middlewares/authMiddleware";
import requireVerifiedEmail from "../middlewares/requireVerifiedEmail";
import uploadLogo from "../middlewares/uploadLogo";

const router = express.Router();

router.post("/", authMiddleware, requireVerifiedEmail, createTournament);
router.get("/", getTournaments);
router.get("/open", getOpenTournaments);
router.get("/:id", getTournamentById);
router.get("/:id/leaderboard", getTournamentLeaderboard);
router.get("/:id/live", getTournamentLive);
// Público a propósito: un `<img src>` no puede mandar el header Authorization.
router.get("/:id/logo", getTournamentLogo);
router.put("/:id/logo", authMiddleware, uploadLogo, uploadTournamentLogo);
router.delete("/:id/logo", authMiddleware, deleteTournamentLogo);
router.put("/:id", authMiddleware, updateTournament);
router.delete("/:id", authMiddleware, deleteTournament);

router.post("/:id/draw", authMiddleware, drawTournament);
router.post("/:id/start", authMiddleware, startTournament);
router.post("/:id/register", authMiddleware, registerToTournament);
router.delete("/:id/register", authMiddleware, unregisterFromTournament);
router.post("/:id/teams/guests", authMiddleware, addGuestTeam);
router.post("/:id/signups/admin", authMiddleware, creatorAddSignup);
router.delete("/:id/signups/admin/:signupId", authMiddleware, creatorRemoveSignup);
router.put("/:id/roster", authMiddleware, replaceTournamentRoster);

router.post("/:tournamentId/teams", authMiddleware, createTeamInTournament);
router.delete("/:tournamentId/teams/:teamId", authMiddleware, removeTeam);

export default router;
