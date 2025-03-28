import express from "express";
import { getAllUsers, getUserById, searchUsers } from "../controllers/user.controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

// Ruta para obtener todos los usuarios
router.get("/", authMiddleware, getAllUsers);

// Ruta para buscar usuarios
router.get("/search", authMiddleware, searchUsers);

// Ruta para obtener un usuario por ID
router.get("/:id", authMiddleware, getUserById);

export default router; 