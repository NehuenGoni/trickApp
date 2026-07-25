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
exports.deleteUser = exports.adjustUserPoints = exports.resetUserPassword = exports.updateUser = exports.getUserDetail = exports.listUsers = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const Match_1 = __importDefault(require("../models/Match"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const constants_1 = require("../config/constants");
const PUBLIC_FIELDS = "-password";
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidRole = (value) => typeof value === "string" && Object.values(constants_1.ROLES).includes(value);
const isDuplicateKeyError = (error) => typeof error === "object" && error !== null && error.code === 11000;
/** Evita que el sistema se quede sin ningún superadmin con acceso. */
const wouldRemoveLastSuperAdmin = (targetId, currentRole, nextRole) => __awaiter(void 0, void 0, void 0, function* () {
    if (currentRole !== constants_1.ROLES.SUPERADMIN)
        return false;
    if (nextRole === constants_1.ROLES.SUPERADMIN)
        return false;
    const remaining = yield User_1.default.countDocuments({
        role: constants_1.ROLES.SUPERADMIN,
        _id: { $ne: new mongoose_1.default.Types.ObjectId(targetId) }
    });
    return remaining === 0;
});
const generateTempPassword = () => crypto_1.default.randomBytes(6).toString("base64url").slice(0, 10);
const listUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const search = (_a = req.query.search) === null || _a === void 0 ? void 0 : _a.trim();
        const role = req.query.role;
        const filter = {};
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { username: { $regex: escaped, $options: "i" } },
                { email: { $regex: escaped, $options: "i" } }
            ];
        }
        if (role && isValidRole(role))
            filter.role = role;
        const sortField = req.query.sortBy || "createdAt";
        const allowedSort = ["createdAt", "username", "email", "totalPoints", "role"];
        const sortBy = allowedSort.includes(sortField) ? sortField : "createdAt";
        const sortDir = req.query.sortDir === "asc" ? 1 : -1;
        const [users, total] = yield Promise.all([
            User_1.default.find(filter)
                .select(PUBLIC_FIELDS)
                .sort({ [sortBy]: sortDir })
                .skip((page - 1) * limit)
                .limit(limit),
            User_1.default.countDocuments(filter)
        ]);
        res.status(200).json({
            users,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al listar usuarios", error: error.message });
    }
});
exports.listUsers = listUsers;
const getUserDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de usuario inválido" });
        }
        const user = yield User_1.default.findById(id).select(PUBLIC_FIELDS);
        if (!user) {
            return void res.status(404).json({ message: "Usuario no encontrado" });
        }
        const [matchesPlayed, tournamentsCreated, tournamentsPlayed] = yield Promise.all([
            Match_1.default.countDocuments({ "teams.players.playerId": id }),
            Tournament_1.default.countDocuments({ createdBy: id }),
            Tournament_1.default.countDocuments({
                $or: [
                    { "teams.players.playerId": id },
                    { "individualSignups.userId": id },
                    { "playerStats.playerId": id }
                ]
            })
        ]);
        res.status(200).json({
            user,
            stats: { matchesPlayed, tournamentsCreated, tournamentsPlayed }
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener el usuario", error: error.message });
    }
});
exports.getUserDetail = getUserDetail;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { username, email, role } = req.body;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de usuario inválido" });
        }
        const user = yield User_1.default.findById(id);
        if (!user) {
            return void res.status(404).json({ message: "Usuario no encontrado" });
        }
        if (username !== undefined) {
            const trimmed = username.trim();
            if (trimmed.length < 3) {
                return void res.status(400).json({
                    message: "El nombre de usuario debe tener al menos 3 caracteres"
                });
            }
            user.username = trimmed;
        }
        if (email !== undefined) {
            const trimmed = email.trim().toLowerCase();
            if (!EMAIL_REGEX.test(trimmed)) {
                return void res.status(400).json({ message: "Email inválido" });
            }
            user.email = trimmed;
        }
        if (role !== undefined) {
            if (!isValidRole(role)) {
                return void res.status(400).json({
                    message: `Rol inválido (${Object.values(constants_1.ROLES).join(" | ")})`
                });
            }
            if (id === req.user && role !== constants_1.ROLES.SUPERADMIN) {
                return void res.status(400).json({
                    message: "No podés quitarte a vos mismo el rol de superadmin"
                });
            }
            if (yield wouldRemoveLastSuperAdmin(id, user.role, role)) {
                return void res.status(400).json({
                    message: "No se puede degradar al último superadmin del sistema"
                });
            }
            user.role = role;
        }
        yield user.save();
        const updated = yield User_1.default.findById(id).select(PUBLIC_FIELDS);
        res.status(200).json({ message: "Usuario actualizado", user: updated });
    }
    catch (error) {
        if (isDuplicateKeyError(error)) {
            return void res.status(409).json({ message: "Ese email ya está en uso" });
        }
        res.status(500).json({ message: "Error al actualizar el usuario", error: error.message });
    }
});
exports.updateUser = updateUser;
const resetUserPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de usuario inválido" });
        }
        const user = yield User_1.default.findById(id);
        if (!user) {
            return void res.status(404).json({ message: "Usuario no encontrado" });
        }
        const generated = !newPassword;
        const password = newPassword !== null && newPassword !== void 0 ? newPassword : generateTempPassword();
        if (password.length < MIN_PASSWORD_LENGTH) {
            return void res.status(400).json({
                message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
            });
        }
        // El hook pre-save hashea y marca `passwordChangedAt`, lo que invalida
        // cualquier token que el usuario tuviera activo.
        user.password = password;
        yield user.save();
        res.status(200).json(Object.assign({ message: `Contraseña de ${user.username} restablecida. Sus sesiones activas se cerraron.` }, (generated ? { temporaryPassword: password } : {})));
    }
    catch (error) {
        res.status(500).json({ message: "Error al restablecer la contraseña", error: error.message });
    }
});
exports.resetUserPassword = resetUserPassword;
const adjustUserPoints = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { mode, value, reason } = req.body;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de usuario inválido" });
        }
        if (mode !== "set" && mode !== "delta") {
            return void res.status(400).json({ message: "Modo inválido (set | delta)" });
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return void res.status(400).json({ message: "El valor debe ser un número" });
        }
        if (!reason || !reason.trim()) {
            return void res.status(400).json({ message: "El motivo del ajuste es obligatorio" });
        }
        const user = yield User_1.default.findById(id);
        if (!user) {
            return void res.status(404).json({ message: "Usuario no encontrado" });
        }
        const current = (_a = user.totalPoints) !== null && _a !== void 0 ? _a : 0;
        const next = mode === "set" ? value : current + value;
        if (next < 0) {
            return void res.status(400).json({ message: "Los puntos no pueden quedar en negativo" });
        }
        const delta = next - current;
        if (delta === 0) {
            return void res.status(400).json({ message: "El ajuste no cambia los puntos actuales" });
        }
        user.totalPoints = next;
        user.pointsAdjustments.push({
            delta,
            reason: reason.trim(),
            adjustedBy: req.user ? new mongoose_1.default.Types.ObjectId(req.user) : undefined,
            adjustedAt: new Date()
        });
        yield user.save();
        res.status(200).json({
            message: `Puntos actualizados: ${current} → ${next}`,
            totalPoints: next,
            delta
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al ajustar los puntos", error: error.message });
    }
});
exports.adjustUserPoints = adjustUserPoints;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de usuario inválido" });
        }
        if (id === req.user) {
            return void res.status(400).json({ message: "No podés eliminar tu propia cuenta" });
        }
        const user = yield User_1.default.findById(id);
        if (!user) {
            return void res.status(404).json({ message: "Usuario no encontrado" });
        }
        if (yield wouldRemoveLastSuperAdmin(id, user.role)) {
            return void res.status(400).json({
                message: "No se puede eliminar al último superadmin del sistema"
            });
        }
        const activeTournaments = yield Tournament_1.default.countDocuments({
            createdBy: id,
            status: { $in: ["upcoming", "in_progress"] }
        });
        if (activeTournaments > 0) {
            return void res.status(409).json({
                message: `El usuario es organizador de ${activeTournaments} torneo(s) sin finalizar. Finalizalos o eliminalos antes de borrar la cuenta.`
            });
        }
        // Se lo quita de las inscripciones abiertas; el historial de partidos y
        // torneos jugados conserva el nombre embebido y no se toca.
        yield Tournament_1.default.updateMany({ status: "upcoming" }, {
            $pull: {
                individualSignups: { userId: user._id },
                teams: { "players.playerId": user._id }
            }
        });
        yield user.deleteOne();
        res.status(200).json({ message: `Usuario ${user.username} eliminado` });
    }
    catch (error) {
        res.status(500).json({ message: "Error al eliminar el usuario", error: error.message });
    }
});
exports.deleteUser = deleteUser;
