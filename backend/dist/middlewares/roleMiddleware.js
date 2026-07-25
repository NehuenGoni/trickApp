"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = exports.requireSuperAdmin = exports.requireAdmin = exports.requireRole = void 0;
const constants_1 = require("../config/constants");
/**
 * Restringe el acceso a los roles indicados.
 * Debe montarse siempre después de `authMiddleware`, que es quien resuelve `req.authUser`.
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        var _a;
        const role = (_a = req.authUser) === null || _a === void 0 ? void 0 : _a.role;
        if (!role) {
            res.status(401).json({ message: "Acceso no autorizado" });
            return;
        }
        if (!roles.includes(role)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
/** Admin o superadmin: gestión de torneos, partidos y métricas. */
exports.requireAdmin = (0, exports.requireRole)(...constants_1.ADMIN_ROLES);
/** Solo superadmin: gestión de usuarios, roles, contraseñas y puntos. */
exports.requireSuperAdmin = (0, exports.requireRole)(constants_1.ROLES.SUPERADMIN);
const isAdmin = (role) => !!role && constants_1.ADMIN_ROLES.includes(role);
exports.isAdmin = isAdmin;
