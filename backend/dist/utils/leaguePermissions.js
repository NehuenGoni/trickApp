"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireLeagueManager = exports.canManageLeague = exports.canManageLeagues = void 0;
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
/**
 * PUNTO ÚNICO DE DECISIÓN de quién puede administrar ligas (crear, editar,
 * borrar, agregar/quitar torneos, y setear `league` al crear/editar un torneo).
 *
 * Hoy es provisional: solo admin/superadmin, igual que el resto del panel.
 * El plan es reemplazarlo por un sistema de suscripción todavía no
 * desarrollado. Cuando exista, este archivo es lo ÚNICO que hay que tocar —
 * por eso cada mutación de liga (acá y en tournament.controller.ts /
 * adminTournament.controller.ts) pasa por estas funciones en vez de
 * chequear el rol a mano.
 */
const canManageLeagues = (actor) => (0, roleMiddleware_1.isAdmin)(actor === null || actor === void 0 ? void 0 : actor.role);
exports.canManageLeagues = canManageLeagues;
/**
 * Variante por documento: admin/superadmin, o el `createdBy` de la liga.
 * Deja el hueco para el día en que esto se reemplace por un sistema de
 * suscripción (ver comentario de arriba).
 */
const canManageLeague = (actor, league) => { var _a; return (0, exports.canManageLeagues)(actor) || (!!actor && ((_a = league.createdBy) === null || _a === void 0 ? void 0 : _a.toString()) === actor.id); };
exports.canManageLeague = canManageLeague;
/** Middleware de ruta. Debe montarse siempre después de `authMiddleware`. */
const requireLeagueManager = (req, res, next) => {
    if (!req.authUser) {
        res.status(401).json({ message: "Acceso no autorizado" });
        return;
    }
    if (!(0, exports.canManageLeagues)(req.authUser)) {
        res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
        return;
    }
    next();
};
exports.requireLeagueManager = requireLeagueManager;
