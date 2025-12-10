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
exports.updateProfile = exports.profileData = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
        res.status(201).json({ message: "Usuario registrado con éxito", user: newUser });
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
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
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
