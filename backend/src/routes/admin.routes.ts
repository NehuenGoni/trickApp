import express from "express";
import authMiddleware from "../middlewares/authMiddleware";
import { requireAdmin, requireSuperAdmin } from "../middlewares/roleMiddleware";
import {
  listUsers,
  getUserDetail,
  updateUser,
  resetUserPassword,
  adjustUserPoints,
  deleteUser
} from "../controllers/adminUser.controller";
import {
  listTournaments,
  updateTournament,
  resetTournament,
  forceCloseTournament,
  recalculateTournamentPoints,
  deleteTournament,
  getTournamentMatches,
  updateMatch,
  deleteMatch,
  getAdminStats
} from "../controllers/adminTournament.controller";
import {
  listSubscriptions,
  getUserBillingHistory,
  grantUserSubscription,
  updateUserPlan
} from "../controllers/adminBilling.controller";
import { getAdminPricing, updateAdminPricing } from "../controllers/adminPricing.controller";

const router = express.Router();

// Todo el panel exige sesión válida y, como mínimo, rol de admin.
router.use(authMiddleware);

// --- Métricas ---
router.get("/stats", requireAdmin, getAdminStats);

// --- Torneos y partidos: admin y superadmin ---
router.get("/tournaments", requireAdmin, listTournaments);
router.put("/tournaments/:id", requireAdmin, updateTournament);
router.delete("/tournaments/:id", requireAdmin, deleteTournament);
router.post("/tournaments/:id/reset", requireAdmin, resetTournament);
router.post("/tournaments/:id/close", requireAdmin, forceCloseTournament);
router.post("/tournaments/:id/recalculate", requireAdmin, recalculateTournamentPoints);
router.get("/tournaments/:id/matches", requireAdmin, getTournamentMatches);

router.put("/matches/:id", requireAdmin, updateMatch);
router.delete("/matches/:id", requireAdmin, deleteMatch);

// --- Usuarios: solo superadmin ---
router.get("/users", requireSuperAdmin, listUsers);
router.get("/users/:id", requireSuperAdmin, getUserDetail);
router.put("/users/:id", requireSuperAdmin, updateUser);
router.delete("/users/:id", requireSuperAdmin, deleteUser);
router.post("/users/:id/password", requireSuperAdmin, resetUserPassword);
router.post("/users/:id/points", requireSuperAdmin, adjustUserPoints);

// --- Suscripciones: solo superadmin ---
router.get("/subscriptions", requireSuperAdmin, listSubscriptions);
router.get("/users/:id/billing", requireSuperAdmin, getUserBillingHistory);
router.post("/users/:id/subscription", requireSuperAdmin, grantUserSubscription);
router.put("/users/:id/plan", requireSuperAdmin, updateUserPlan);

// --- Precios: solo superadmin ---
router.get("/pricing", requireSuperAdmin, getAdminPricing);
router.put("/pricing", requireSuperAdmin, updateAdminPricing);

export default router;
