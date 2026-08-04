"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const league_controller_1 = require("../controllers/league.controller");
const leagueLogo_controller_1 = require("../controllers/leagueLogo.controller");
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const uploadLogo_1 = __importDefault(require("../middlewares/uploadLogo"));
const router = express_1.default.Router();
router.post("/", authMiddleware_1.default, league_controller_1.createLeague);
router.get("/", league_controller_1.getLeagues);
router.get("/:id", league_controller_1.getLeagueById);
router.put("/:id", authMiddleware_1.default, league_controller_1.updateLeague);
router.delete("/:id", authMiddleware_1.default, league_controller_1.deleteLeague);
router.get("/:id/standings", league_controller_1.getLeagueStandings);
router.put("/:id/tournaments/:tournamentId", authMiddleware_1.default, league_controller_1.attachTournament);
router.delete("/:id/tournaments/:tournamentId", authMiddleware_1.default, league_controller_1.detachTournament);
// Público a propósito: un `<img src>` no puede mandar el header Authorization.
router.get("/:id/logo", leagueLogo_controller_1.getLeagueLogo);
router.put("/:id/logo", authMiddleware_1.default, uploadLogo_1.default, leagueLogo_controller_1.uploadLeagueLogo);
router.delete("/:id/logo", authMiddleware_1.default, leagueLogo_controller_1.deleteLeagueLogo);
exports.default = router;
