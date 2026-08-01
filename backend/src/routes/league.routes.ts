import express from "express";
import {
  createLeague,
  getLeagues,
  getLeagueById,
  updateLeague,
  deleteLeague,
  attachTournament,
  detachTournament,
  getLeagueStandings
} from "../controllers/league.controller";
import {
  getLeagueLogo,
  uploadLeagueLogo,
  deleteLeagueLogo
} from "../controllers/leagueLogo.controller";
import authMiddleware from "../middlewares/authMiddleware";
import uploadLogo from "../middlewares/uploadLogo";

const router = express.Router();

router.post("/", authMiddleware, createLeague);
router.get("/", getLeagues);
router.get("/:id", getLeagueById);
router.put("/:id", authMiddleware, updateLeague);
router.delete("/:id", authMiddleware, deleteLeague);

router.get("/:id/standings", getLeagueStandings);
router.put("/:id/tournaments/:tournamentId", authMiddleware, attachTournament);
router.delete("/:id/tournaments/:tournamentId", authMiddleware, detachTournament);

// Público a propósito: un `<img src>` no puede mandar el header Authorization.
router.get("/:id/logo", getLeagueLogo);
router.put("/:id/logo", authMiddleware, uploadLogo, uploadLeagueLogo);
router.delete("/:id/logo", authMiddleware, deleteLeagueLogo);

export default router;
