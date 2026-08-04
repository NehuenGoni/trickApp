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
exports.computeLeagueStandings = void 0;
const Tournament_1 = __importDefault(require("../models/Tournament"));
const User_1 = __importDefault(require("../models/User"));
/** trim → minúsculas → sin acentos → espacios colapsados. */
const normalizeGuestName = (name) => name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas combinantes (acentos, tildes)
    .replace(/\s+/g, " ");
/**
 * Identidad de un participante para agrupar puntos entre torneos.
 *
 * Los usuarios registrados se agrupan por `playerId`, que es estable. Los
 * invitados no tienen cuenta (`awardTournamentPoints` los excluye del
 * ranking global justamente por eso), así que acá se agrupan por nombre
 * normalizado: es una aproximación con dos limitaciones conocidas y
 * aceptadas — dos personas distintas con el mismo nombre se fusionan en una
 * fila, y la misma persona anotada con variantes del nombre ("Juan" /
 * "Juan P.") genera filas separadas. La liga es su propia competencia y a
 * propósito no usa la misma regla que el ranking global: acá SÍ suman.
 */
const statKey = (s) => !s.isGuest && s.playerId ? `user:${s.playerId.toString()}` : `guest:${normalizeGuestName(s.name)}`;
const computeLeagueStandings = (leagueId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const tournaments = yield Tournament_1.default.find({ league: leagueId, status: "completed" })
        .select("playerStats startDate")
        .sort({ startDate: 1 })
        .lean();
    const acc = new Map();
    for (const t of tournaments) {
        for (const s of (_a = t.playerStats) !== null && _a !== void 0 ? _a : []) {
            if (s.isGuest && !((_b = s.name) === null || _b === void 0 ? void 0 : _b.trim()))
                continue;
            const key = statKey(s);
            if (key === "guest:")
                continue;
            let row = acc.get(key);
            if (!row) {
                row = {
                    key,
                    // Primera grafía vista (los torneos están ordenados por fecha):
                    // suele ser la original y es determinista.
                    displayName: s.isGuest ? s.name : s.name,
                    userId: !s.isGuest && s.playerId ? s.playerId.toString() : null,
                    isGuest: !!s.isGuest,
                    points: 0,
                    tournamentsPlayed: 0,
                    wins: 0,
                    podiums: 0,
                    bestPosition: Infinity
                };
                acc.set(key, row);
            }
            row.points += s.points;
            row.tournamentsPlayed += 1;
            if (s.position === 1)
                row.wins += 1;
            if (s.position <= 3)
                row.podiums += 1;
            if (s.position < row.bestPosition)
                row.bestPosition = s.position;
        }
    }
    // Completar el nombre de los usuarios registrados con el username actual
    // (el que viene en playerStats es una foto del momento del torneo).
    const userIds = [...acc.values()].filter((r) => r.userId).map((r) => r.userId);
    if (userIds.length > 0) {
        const users = yield User_1.default.find({ _id: { $in: userIds } }).select("username").lean();
        const usernameById = new Map(users.map((u) => [u._id.toString(), u.username]));
        for (const row of acc.values()) {
            if (row.userId) {
                // Usuario borrado: se deja el nombre que trae playerStats en vez de
                // inventar una fila fantasma o descartar sus puntos.
                row.displayName = (_c = usernameById.get(row.userId)) !== null && _c !== void 0 ? _c : row.displayName;
            }
        }
    }
    const sorted = [...acc.values()].sort((a, b) => {
        if (b.points !== a.points)
            return b.points - a.points;
        if (b.wins !== a.wins)
            return b.wins - a.wins;
        if (a.bestPosition !== b.bestPosition)
            return a.bestPosition - b.bestPosition;
        return a.displayName.localeCompare(b.displayName);
    });
    const standings = [];
    let lastPoints = null;
    let lastPosition = 0;
    sorted.forEach((row, index) => {
        // Dense ranking: empate en puntos ⇒ misma posición.
        if (lastPoints === null || row.points !== lastPoints) {
            lastPosition = index + 1;
            lastPoints = row.points;
        }
        standings.push({
            key: row.key,
            position: lastPosition,
            displayName: row.displayName,
            userId: row.userId,
            isGuest: row.isGuest,
            points: row.points,
            tournamentsPlayed: row.tournamentsPlayed,
            wins: row.wins,
            podiums: row.podiums,
            bestPosition: row.bestPosition === Infinity ? 0 : row.bestPosition
        });
    });
    return {
        standings,
        tournamentsCounted: tournaments.length,
        guestCount: standings.filter((r) => r.isGuest).length
    };
});
exports.computeLeagueStandings = computeLeagueStandings;
