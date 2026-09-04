import express from "express";
import {
  createMatch,
  updateMatch,
  updateMatchScore,
  setMatchResult,
  clearMatchResult,
  getMatches,
  getMatchById,
  deleteMatch,
  getMatchesByTournament
} from "../controllers/match.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createMatch);
router.put("/:id", authMiddleware, updateMatch);
router.patch("/:id/score", authMiddleware, updateMatchScore);
// Carga manual del organizador (distinto del marcador en vivo de arriba):
// anota o corrige el resultado final de un partido de torneo directamente.
router.put("/:id/result", authMiddleware, setMatchResult);
router.delete("/:id/result", authMiddleware, clearMatchResult);

router.get("/", getMatches);
router.get("/:id", getMatchById);
router.delete("/:id", authMiddleware, deleteMatch);

router.get("/tournament/:tournamentId", getMatchesByTournament);

export default router;
