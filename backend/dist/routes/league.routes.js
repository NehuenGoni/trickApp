"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const league_controller_1 = require("../controllers/league.controller");
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const router = express_1.default.Router();
router.post("/", authMiddleware_1.default, league_controller_1.createLeague);
router.get("/", league_controller_1.getLeagues);
router.get("/:id", league_controller_1.getLeagueById);
router.post("/add-tournament", authMiddleware_1.default, league_controller_1.addTournamentToLeague);
router.post("/update-points", authMiddleware_1.default, league_controller_1.updateUserLeaguePoints);
router.get("/:id/standings", league_controller_1.getLeagueStandings);
exports.default = router;
