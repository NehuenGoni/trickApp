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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = __importDefault(require("../models/User"));
dotenv_1.default.config();
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ message: "Acceso no autorizado" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = yield User_1.default.findById(decoded.userId).select("role passwordChangedAt");
        if (!user) {
            res.status(401).json({ message: "Token inválido" });
            return;
        }
        // Un cambio de contraseña (propio o hecho por un admin) invalida los tokens previos.
        if (user.passwordChangedAt &&
            decoded.iat &&
            decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
            res.status(401).json({ message: "Token inválido" });
            return;
        }
        req.user = decoded.userId;
        req.authUser = { id: decoded.userId, role: user.role };
        next();
    }
    catch (err) {
        res.status(400).json({ message: "Token inválido" });
        return;
    }
});
exports.default = authMiddleware;
