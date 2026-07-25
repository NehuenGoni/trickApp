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
exports.getTournamentLive = void 0;
const Tournament_1 = __importDefault(require("../models/Tournament"));
const Match_1 = __importDefault(require("../models/Match"));
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const updatedAtMs = (doc) => doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
/**
 * Vista pública y de solo lectura de un torneo, pensada para una pantalla de
 * transmisión (proyector/TV) sin login. Devuelve nombres y marcadores, nunca
 * ids de usuario, emails ni datos de quién creó/inscribió qué.
 *
 * Soporta `?since=<version>` para long-polling liviano: si nada cambió desde
 * esa versión, responde `{ version, changed: false }` sin armar el payload
 * completo.
 */
const getTournamentLive = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!OBJECT_ID_RE.test(id)) {
            res.status(400).json({ message: "ID de torneo inválido" });
            return;
        }
        const tournament = yield Tournament_1.default.findById(id).lean();
        if (!tournament) {
            res.status(404).json({ message: "Torneo no encontrado" });
            return;
        }
        const matches = yield Match_1.default.find({ tournament: id }).lean();
        const maxMatchUpdatedAt = matches.reduce((max, m) => Math.max(max, updatedAtMs(m)), 0);
        const version = `${Math.max(updatedAtMs(tournament), maxMatchUpdatedAt)}-${matches.length}`;
        res.set("Cache-Control", "no-store");
        if (req.query.since === version) {
            res.status(200).json({ version, changed: false });
            return;
        }
        const teamNameById = new Map();
        for (const t of tournament.teams) {
            teamNameById.set(t.teamId.toString(), t.name);
        }
        const teams = tournament.teams.map((t) => ({
            teamId: t.teamId,
            name: t.name,
            players: t.players.map((p) => ({ name: p.name, isGuest: !!p.isGuest }))
        }));
        const formattedMatches = matches.map((m) => ({
            _id: m._id,
            phase: m.phase,
            bracketSlot: m.bracketSlot,
            status: m.status,
            winner: m.winner,
            teams: m.teams.map((t) => ({
                teamId: t.teamId,
                name: (t.teamId && teamNameById.get(t.teamId.toString())) || "Equipo",
                score: t.score,
                players: t.players.map((p) => p.username).filter(Boolean)
            }))
        }));
        const standings = [...tournament.playerStats]
            .sort((a, b) => a.position - b.position)
            .map((s) => ({ name: s.name, position: s.position, points: s.points }));
        res.status(200).json({
            version,
            changed: true,
            tournament: {
                _id: tournament._id,
                name: tournament.name,
                type: tournament.type,
                format: tournament.format,
                status: tournament.status,
                startDate: tournament.startDate,
                description: tournament.description
            },
            teams,
            matches: formattedMatches,
            standings
        });
    }
    catch (error) {
        const err = error;
        res.status(500).json({
            message: "Error al obtener el estado en vivo del torneo",
            error: { message: err.message }
        });
    }
});
exports.getTournamentLive = getTournamentLive;
