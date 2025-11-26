import { Router } from "express";
import {
  createMatch,
  getMatches,
  getMatchById,
  updateMatch,
  deleteMatch
} from "../controllers/match.controller";

const router = Router();

router.post("/", createMatch);
router.get("/", getMatches);
router.get("/:id", getMatchById);
router.put("/:id", updateMatch);
router.delete("/:id", deleteMatch);

export default router; 