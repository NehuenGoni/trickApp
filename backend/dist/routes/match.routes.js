"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const match_controller_1 = require("../controllers/match.controller");
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const router = express_1.default.Router();
router.post("/", authMiddleware_1.default, match_controller_1.createMatch);
router.put("/:id", authMiddleware_1.default, match_controller_1.updateMatch);
router.get("/", match_controller_1.getMatches);
router.get("/:id", match_controller_1.getMatchById);
router.delete("/:id", match_controller_1.deleteMatch);
router.get("/tournament/:tournamentId", match_controller_1.getMatchesByTournament);
exports.default = router;
