"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const router = express_1.default.Router();
router.post("/register", auth_controller_1.registerUser);
router.post("/login", auth_controller_1.loginUser);
// Recuperación de contraseña (públicas: el usuario no puede iniciar sesión)
router.post("/forgot-password", auth_controller_1.forgotPassword);
router.get("/reset-password/:token", auth_controller_1.verifyResetToken);
router.post("/reset-password/:token", auth_controller_1.resetPassword);
router.get("/profile", authMiddleware_1.default, auth_controller_1.profileData);
router.put("/profile", authMiddleware_1.default, auth_controller_1.updateProfile);
exports.default = router;
