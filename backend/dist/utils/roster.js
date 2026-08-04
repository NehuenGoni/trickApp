"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRosterPayload = exports.playerKey = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const constants_1 = require("../config/constants");
/**
 * Clave para comparar un jugador entre el pool (`individualSignups`) y los
 * equipos. Preferimos `signupId`; los torneos ya sorteados en producción no lo
 * tienen, así que caemos a `playerId` y, para invitados legacy, al nombre
 * normalizado — no hay mejor ancla, los invitados no tienen id propio.
 */
const playerKey = (p) => {
    if (p.signupId)
        return `s:${p.signupId}`;
    if (p.playerId)
        return `u:${p.playerId}`;
    return `g:${p.name.trim().toLowerCase()}`;
};
exports.playerKey = playerKey;
const STALE_MESSAGE = "La lista de jugadores no coincide con los inscriptos del torneo. Recargá la página e intentá de nuevo.";
const validateRosterPayload = (args) => {
    var _a, _b;
    const { payload, teamFormationMode, teamSize, existingTeams, individualSignups } = args;
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.teams)) {
        return { ok: false, error: "Falta la lista de equipos", status: 400 };
    }
    const inputTeams = payload.teams;
    if (inputTeams.length > 8) {
        return { ok: false, error: "No puede haber más de 8 equipos", status: 400 };
    }
    for (const t of inputTeams) {
        if (!Array.isArray(t.players)) {
            return { ok: false, error: "Cada equipo debe tener una lista de jugadores", status: 400 };
        }
        if (t.players.length > teamSize) {
            return {
                ok: false,
                error: `Cada equipo puede tener hasta ${teamSize} jugadores (formato ${teamSize === 3 ? "trios" : "duos"})`,
                status: 400
            };
        }
    }
    const isPoolBased = teamFormationMode !== constants_1.TEAM_FORMATION_MODES.USER_FORMED;
    // Equipos "fijos" (cargados enteros a mano en modo pool): no pasan por acá.
    const editableExisting = new Map();
    const fixedTeamIds = new Set();
    for (const t of existingTeams) {
        const id = t.teamId.toString();
        if (isPoolBased && !t.isDrawn) {
            fixedTeamIds.add(id);
        }
        else {
            editableExisting.set(id, t);
        }
    }
    const seenTeamIds = new Set();
    for (const t of inputTeams) {
        if (t.teamId === undefined) {
            if (!isPoolBased) {
                return { ok: false, error: "En este modo no se pueden crear equipos nuevos", status: 400 };
            }
            continue;
        }
        if (fixedTeamIds.has(t.teamId)) {
            return { ok: false, error: `El equipo ${t.teamId} es fijo y no se puede reorganizar acá`, status: 400 };
        }
        if (!editableExisting.has(t.teamId)) {
            return { ok: false, error: `El equipo ${t.teamId} no pertenece a este torneo`, status: 400 };
        }
        if (seenTeamIds.has(t.teamId)) {
            return { ok: false, error: "Hay equipos repetidos en la lista", status: 400 };
        }
        seenTeamIds.add(t.teamId);
    }
    if (!isPoolBased && seenTeamIds.size !== editableExisting.size) {
        return { ok: false, error: "Faltan equipos del torneo en la lista", status: 400 };
    }
    // Universo de jugadores movibles: el pool en modos pool-based, o el conjunto
    // de jugadores ya repartidos en los equipos editables en user-formed.
    const universe = isPoolBased
        ? new Map(individualSignups.map((s) => [(0, exports.playerKey)(s), s]))
        : new Map([...editableExisting.values()]
            .flatMap((t) => t.players)
            .map((p) => [(0, exports.playerKey)(p), p]));
    const payloadKeys = new Set();
    for (const t of inputTeams) {
        for (const p of t.players) {
            if (!p || typeof p.name !== "string" || !p.name.trim()) {
                return { ok: false, error: "Falta el nombre de un jugador", status: 400 };
            }
            const key = (0, exports.playerKey)(p);
            if (!universe.has(key)) {
                return { ok: false, error: STALE_MESSAGE, status: 409 };
            }
            if (payloadKeys.has(key)) {
                return { ok: false, error: `El jugador ${p.name} aparece en más de un equipo`, status: 400 };
            }
            payloadKeys.add(key);
        }
    }
    // En user-formed no se puede dejar a nadie afuera: el multiconjunto tiene
    // que ser exactamente el mismo, no un subconjunto.
    if (!isPoolBased && payloadKeys.size !== universe.size) {
        return { ok: false, error: STALE_MESSAGE, status: 409 };
    }
    // Arma los jugadores desde la fuente confiable (pool o equipo actual), nunca
    // desde los campos sueltos que mandó el cliente (playerId/isGuest podrían
    // no corresponder a `signupId`).
    const buildPlayer = (key) => {
        const source = universe.get(key);
        if (isPoolBased) {
            const s = source;
            return { playerId: s.userId, name: s.name, isGuest: s.isGuest, signupId: s.signupId };
        }
        const p = source;
        return { playerId: p.playerId, name: p.name, isGuest: p.isGuest, signupId: p.signupId };
    };
    let newTeamCount = 0;
    const resultTeams = [];
    for (const t of inputTeams) {
        if (t.players.length === 0)
            continue; // placeholder vacío: no crea equipo
        const players = t.players.map((p) => buildPlayer((0, exports.playerKey)(p)));
        if (t.teamId !== undefined) {
            const existing = editableExisting.get(t.teamId);
            resultTeams.push({
                teamId: existing.teamId,
                name: ((_a = t.name) === null || _a === void 0 ? void 0 : _a.trim()) || existing.name,
                registeredBy: existing.registeredBy,
                isDrawn: existing.isDrawn,
                players
            });
        }
        else {
            newTeamCount += 1;
            resultTeams.push({
                teamId: new mongoose_1.default.Types.ObjectId(),
                name: ((_b = t.name) === null || _b === void 0 ? void 0 : _b.trim()) || `Equipo ${existingTeams.length + newTeamCount}`,
                isDrawn: true,
                players
            });
        }
    }
    if (!isPoolBased) {
        const incomplete = resultTeams.find((t) => t.players.length !== teamSize);
        if (incomplete) {
            return {
                ok: false,
                error: `En este modo todos los equipos deben quedar completos (${teamSize} jugadores). Intercambiá jugadores en vez de moverlos.`,
                status: 400
            };
        }
    }
    const finalTeams = [...existingTeams.filter((t) => fixedTeamIds.has(t.teamId.toString())), ...resultTeams];
    const beforeIds = new Set(existingTeams.map((t) => t.teamId.toString()));
    const afterIds = new Set(finalTeams.map((t) => t.teamId.toString()));
    const draftInvalidated = beforeIds.size !== afterIds.size || [...beforeIds].some((id) => !afterIds.has(id));
    return { ok: true, teams: finalTeams, draftInvalidated };
};
exports.validateRosterPayload = validateRosterPayload;
