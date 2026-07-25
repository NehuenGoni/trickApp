"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifyResetToken = exports.forgotPassword = exports.updateProfile = exports.profileData = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const dotenv_1 = __importDefault(require("dotenv"));
const constants_1 = require("../config/constants");
const mailer_1 = require("../utils/mailer");
const rateLimiter_1 = require("../utils/rateLimiter");
dotenv_1.default.config();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Máximo 3 pedidos de recuperación por email cada 15 minutos. */
const forgotPasswordLimiter = (0, rateLimiter_1.createRateLimiter)(3, 15 * 60 * 1000);
const hashResetToken = (token) => crypto_1.default.createHash("sha256").update(token).digest("hex");
const buildResetUrl = (token) => {
    const base = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    return `${base}/reset-password/${token}`;
};
/** Busca el usuario dueño de un token de recuperación vigente. */
const findUserByResetToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    return User_1.default.findOne({
        passwordResetToken: hashResetToken(token),
        passwordResetExpires: { $gt: new Date() }
    }).select("+passwordResetToken +passwordResetExpires");
});
const registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, password } = req.body;
        const userExists = yield User_1.default.findOne({ email });
        if (userExists) {
            res.status(400).json({ message: "Usuario ya existe" });
            return;
        }
        const newUser = new User_1.default({
            username,
            email,
            password,
        });
        yield newUser.save();
        res.status(201).json({
            message: "Usuario registrado con éxito",
            user: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email
            }
        });
    }
    catch (err) {
        res.status(500).json({ message: "Error al registrar el usuario", error: err });
    }
});
exports.registerUser = registerUser;
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield User_1.default.findOne({ email });
        if (!user) {
            res.status(400).json({ message: "Usuario no encontrado" });
            return;
        }
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(400).json({ message: "Contraseña incorrecta" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "60d" });
        res.status(200).json({ message: "Login exitoso", token, userId: user._id });
    }
    catch (err) {
        res.status(500).json({ message: "Error en el login", error: err });
    }
});
exports.loginUser = loginUser;
const profileData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.default.findById(req.user).select("-password");
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }
        res.json({ user });
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener el perfil", error });
    }
});
exports.profileData = profileData;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, currentPassword, newPassword } = req.body;
    try {
        const user = yield User_1.default.findById(req.user);
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }
        if (username && !newPassword) {
            user.username = username;
            yield user.save();
            res.json({ message: "Nombre de usuario actualizado correctamente" });
            return;
        }
        if (newPassword) {
            const isMatch = yield bcryptjs_1.default.compare(currentPassword, user.password);
            if (!isMatch) {
                res.status(400).json({ message: "La contraseña actual es incorrecta" });
                return;
            }
            user.password = newPassword;
            if (username)
                user.username = username;
            yield user.save();
            res.json({ message: "Perfil actualizado correctamente" });
            return;
        }
    }
    catch (error) {
        res.status(500).json({ message: "Error al actualizar el perfil", error });
    }
});
exports.updateProfile = updateProfile;
/**
 * Genera un enlace de recuperación y lo envía por mail.
 * La respuesta es siempre la misma exista o no la cuenta, para no revelar
 * qué emails están registrados.
 */
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const genericResponse = {
        message: "Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña."
    };
    try {
        const email = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.trim().toLowerCase();
        if (!email || !EMAIL_REGEX.test(email)) {
            res.status(400).json({ message: "Ingresá un email válido" });
            return;
        }
        if (forgotPasswordLimiter.isLimited(email)) {
            res.status(429).json({
                message: "Demasiados intentos. Esperá unos minutos antes de volver a pedir el enlace."
            });
            return;
        }
        const user = yield User_1.default.findOne({ email });
        if (!user) {
            res.status(200).json(genericResponse);
            return;
        }
        const token = crypto_1.default.randomBytes(32).toString("hex");
        user.passwordResetToken = hashResetToken(token);
        user.passwordResetExpires = new Date(Date.now() + constants_1.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
        yield user.save();
        const content = (0, mailer_1.passwordResetEmail)(user.username, buildResetUrl(token), constants_1.PASSWORD_RESET_TTL_MINUTES);
        const delivered = yield (0, mailer_1.sendMail)(Object.assign({ to: user.email }, content));
        // Si SMTP está configurado y el envío falló, el token queda inutilizable para
        // el usuario: se limpia para no dejar un enlace vivo que nadie recibió.
        // Sin SMTP (desarrollo) el enlace se imprime en consola, así que se conserva.
        if (!delivered && (0, mailer_1.isMailConfigured)()) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            yield user.save();
            res.status(502).json({
                message: "No pudimos enviar el mail de recuperación. Intentá de nuevo en unos minutos."
            });
            return;
        }
        res.status(200).json(genericResponse);
    }
    catch (error) {
        res.status(500).json({ message: "Error al procesar la solicitud", error });
    }
});
exports.forgotPassword = forgotPassword;
/** Permite al frontend saber si el enlace sigue siendo válido antes de mostrar el formulario. */
const verifyResetToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield findUserByResetToken(req.params.token);
        if (!user) {
            res.status(400).json({ valid: false, message: "El enlace es inválido o ya venció" });
            return;
        }
        res.status(200).json({ valid: true, email: user.email });
    }
    catch (error) {
        res.status(500).json({ message: "Error al validar el enlace", error });
    }
});
exports.verifyResetToken = verifyResetToken;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { password } = req.body;
        if (!password || password.length < constants_1.MIN_PASSWORD_LENGTH) {
            res.status(400).json({
                message: `La contraseña debe tener al menos ${constants_1.MIN_PASSWORD_LENGTH} caracteres`
            });
            return;
        }
        const user = yield findUserByResetToken(req.params.token);
        if (!user) {
            res.status(400).json({ message: "El enlace es inválido o ya venció" });
            return;
        }
        // El hook pre-save hashea la contraseña y actualiza `passwordChangedAt`,
        // lo que invalida los tokens JWT emitidos antes del cambio.
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        yield user.save();
        forgotPasswordLimiter.reset(user.email);
        // El aviso es informativo: si falla no debe afectar al reseteo, que ya se aplicó.
        yield (0, mailer_1.sendMail)(Object.assign({ to: user.email }, (0, mailer_1.passwordChangedEmail)(user.username)));
        res.status(200).json({ message: "Contraseña actualizada. Ya podés iniciar sesión." });
    }
    catch (error) {
        res.status(500).json({ message: "Error al restablecer la contraseña", error });
    }
});
exports.resetPassword = resetPassword;
