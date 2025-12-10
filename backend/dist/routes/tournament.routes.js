"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tournament_controller_1 = require("../controllers/tournament.controller");
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const router = express_1.default.Router();
router.post("/", authMiddleware_1.default, tournament_controller_1.createTournament);
router.get("/", tournament_controller_1.getTournaments);
router.get("/:id", tournament_controller_1.getTournamentById);
router.put("/:id", authMiddleware_1.default, tournament_controller_1.updateTournament);
router.delete("/:id", authMiddleware_1.default, tournament_controller_1.deleteTournament);
router.post("/:tournamentId/teams", authMiddleware_1.default, tournament_controller_1.createTeamInTournament);
router.put("/:tournamentId/teams/:teamId", authMiddleware_1.default, tournament_controller_1.updateTeam);
router.delete("/:tournamentId/teams/:teamId", authMiddleware_1.default, tournament_controller_1.removeTeam);
exports.default = router;
