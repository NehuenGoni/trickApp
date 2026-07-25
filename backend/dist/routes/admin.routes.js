"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const adminUser_controller_1 = require("../controllers/adminUser.controller");
const adminTournament_controller_1 = require("../controllers/adminTournament.controller");
const router = express_1.default.Router();
// Todo el panel exige sesión válida y, como mínimo, rol de admin.
router.use(authMiddleware_1.default);
// --- Métricas ---
router.get("/stats", roleMiddleware_1.requireAdmin, adminTournament_controller_1.getAdminStats);
// --- Torneos y partidos: admin y superadmin ---
router.get("/tournaments", roleMiddleware_1.requireAdmin, adminTournament_controller_1.listTournaments);
router.put("/tournaments/:id", roleMiddleware_1.requireAdmin, adminTournament_controller_1.updateTournament);
router.delete("/tournaments/:id", roleMiddleware_1.requireAdmin, adminTournament_controller_1.deleteTournament);
router.post("/tournaments/:id/reset", roleMiddleware_1.requireAdmin, adminTournament_controller_1.resetTournament);
router.post("/tournaments/:id/close", roleMiddleware_1.requireAdmin, adminTournament_controller_1.forceCloseTournament);
router.post("/tournaments/:id/recalculate", roleMiddleware_1.requireAdmin, adminTournament_controller_1.recalculateTournamentPoints);
router.get("/tournaments/:id/matches", roleMiddleware_1.requireAdmin, adminTournament_controller_1.getTournamentMatches);
router.put("/matches/:id", roleMiddleware_1.requireAdmin, adminTournament_controller_1.updateMatch);
router.delete("/matches/:id", roleMiddleware_1.requireAdmin, adminTournament_controller_1.deleteMatch);
// --- Usuarios: solo superadmin ---
router.get("/users", roleMiddleware_1.requireSuperAdmin, adminUser_controller_1.listUsers);
router.get("/users/:id", roleMiddleware_1.requireSuperAdmin, adminUser_controller_1.getUserDetail);
router.put("/users/:id", roleMiddleware_1.requireSuperAdmin, adminUser_controller_1.updateUser);
router.delete("/users/:id", roleMiddleware_1.requireSuperAdmin, adminUser_controller_1.deleteUser);
router.post("/users/:id/password", roleMiddleware_1.requireSuperAdmin, adminUser_controller_1.resetUserPassword);
router.post("/users/:id/points", roleMiddleware_1.requireSuperAdmin, adminUser_controller_1.adjustUserPoints);
exports.default = router;
