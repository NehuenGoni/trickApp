import express from "express";
import { registerUser, loginUser } from "../controllers/auth.controller"
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/profile", authMiddleware, (req, res) => {
    res.send("Perfil de usuario");
});

export default router;

