import express from "express";
import {
  getAllUsers,
  getUserById,
  searchUsers,
  getUserMatches,
  getUserMatchesLength,
  getUserNameById,
  getUserStatsSummary
} from "../controllers/user.controller";
import authMiddleware from "../middlewares/authMiddleware";
import { requireSelfOrAdmin } from "../middlewares/selfOrAdmin";

const router = express.Router();

router.get("/", authMiddleware, getAllUsers);

router.get("/search", authMiddleware, searchUsers);

router.get("/matchesNames/:id", authMiddleware, getUserNameById);

// Antes que "/:id/stats" a propósito, aunque Express ya las distingue bien
// por ser rutas literales distintas: queda más claro leerlas en orden.
router.get("/:id/stats/summary", authMiddleware, requireSelfOrAdmin(), getUserStatsSummary);

router.get("/:id/stats", authMiddleware, requireSelfOrAdmin(), getUserMatches);

// @deprecated el front usa stats/summary; se mantiene por compatibilidad.
router.get("/:id/matches-length", authMiddleware, requireSelfOrAdmin(), getUserMatchesLength);

router.get("/:id", authMiddleware, getUserById);


export default router; 