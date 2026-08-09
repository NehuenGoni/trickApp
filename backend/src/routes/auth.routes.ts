import express from "express";
import {
  registerUser,
  loginUser,
  profileData,
  updateProfile,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  verifyEmail,
  resendVerification,
  unsubscribe
} from "../controllers/auth.controller"
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();


router.post("/register", registerUser);
router.post("/login", loginUser);

// Recuperación de contraseña (públicas: el usuario no puede iniciar sesión)
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", verifyResetToken);
router.post("/reset-password/:token", resetPassword);

// Confirmación de cuenta (pública: el usuario todavía no tiene por qué estar logueado)
router.post("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerification);

// Baja de un tipo de notificación desde el link del mail (pública, ver unsubscribeToken.ts)
router.post("/unsubscribe/:token", unsubscribe);

router.get("/profile", authMiddleware, profileData);
router.put("/profile", authMiddleware, updateProfile);

export default router;

