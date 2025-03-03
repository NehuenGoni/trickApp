import express from "express";
import { 
    createTournament, 
    getTournaments, 
    getTournamentById, 
    updateTournament, 
    deleteTournament,
    createTeamInTournament,
    updateTeam,
    removeTeam} from "../controllers/tournament.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createTournament);
router.get("/", getTournaments);
router.get("/:id", getTournamentById); 
router.put("/:id", authMiddleware, updateTournament); 
router.delete("/:id", authMiddleware, deleteTournament);

router.post("/:tournamentId/teams", authMiddleware, createTeamInTournament);
router.put("/:tournamentId/teams/:teamId", authMiddleware, updateTeam);
router.delete("/:tournamentId/teams/:teamId", authMiddleware, removeTeam);


export default router;