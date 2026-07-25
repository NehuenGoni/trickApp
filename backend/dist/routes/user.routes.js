"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("../controllers/user.controller");
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const router = express_1.default.Router();
router.get("/", authMiddleware_1.default, user_controller_1.getAllUsers);
router.get("/search", authMiddleware_1.default, user_controller_1.searchUsers);
router.get("/matchesNames/:id", authMiddleware_1.default, user_controller_1.getUserNameById);
router.get("/:id/stats", authMiddleware_1.default, user_controller_1.getUserMatches);
router.get("/:id/matches-length", authMiddleware_1.default, user_controller_1.getUserMatchesLength);
router.get("/:id", authMiddleware_1.default, user_controller_1.getUserById);
exports.default = router;
