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
exports.getMatchesByTournament = exports.deleteMatch = exports.updateMatchScore = exports.updateMatch = exports.getMatchById = exports.getInProgressMatches = exports.getMatches = exports.createMatch = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Match_1 = __importDefault(require("../models/Match"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const constants_1 = require("../config/constants");
const tournament_controller_1 = require("./tournament.controller");
const TERMINAL_SLOTS = new Set([
    constants_1.BRACKET_SLOTS.FG,
    constants_1.BRACKET_SLOTS.FS,
    constants_1.BRACKET_SLOTS.M34,
    constants_1.BRACKET_SLOTS.M78
]);
// Solo restringe partidos de torneo: en un amistoso el modelo Match no guarda
// quién lo creó, así que no hay contra qué autorizar (un amistoso entre
// invitados no tiene ningún playerId). Se deja igual de laxo que hoy.
// En torneo, puede modificarlo quien juega el partido o quien creó el torneo.
const canModifyMatch = (match, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (match.type !== constants_1.MATCH_TYPES.TOURNAMENT)
        return true;
    const isPlayer = match.teams.some((t) => t.players.some((p) => p.playerId && p.playerId.toString() === userId));
    if (isPlayer)
        return true;
    if (!match.tournament)
        return false;
    const tournament = yield Tournament_1.default.findById(match.tournament);
    return !!tournament && tournament.createdBy.toString() === userId;
});
const createMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournament, teams, type, phase } = req.body;
        if (!Array.isArray(teams)) {
            return void res.status(400).json({
                message: "El campo 'teams' debe ser un array",
                error: { received: teams }
            });
        }
        const matchData = {
            teams,
            status: constants_1.MATCH_STATUS.IN_PROGRESS,
            type
        };
        if (type === constants_1.MATCH_TYPES.TOURNAMENT) {
            if (!tournament) {
                return void res.status(400).json({
                    message: "Se requiere un torneo para partidos de tipo torneo",
                    error: { type, tournament }
                });
            }
            const tournamentData = yield Tournament_1.default.findById(tournament);
            if (!tournamentData) {
                return void res.status(404).json({
                    message: "Torneo no encontrado",
                    error: { tournamentId: tournament }
                });
            }
            matchData.tournament = tournament;
            if (phase)
                matchData.phase = phase;
            const match = new Match_1.default(matchData);
            yield match.save();
            tournamentData.matches.push(match._id);
            yield tournamentData.save();
            return void res.status(201).json(match);
        }
        matchData.type = constants_1.MATCH_TYPES.FRIENDLY;
        const match = new Match_1.default(matchData);
        yield match.save();
        res.status(201).json(match);
    }
    catch (error) {
        const err = error;
        res.status(400).json({
            message: "Error al crear el partido",
            error: { name: err.name, message: err.message }
        });
    }
});
exports.createMatch = createMatch;
const getMatches = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const matches = yield Match_1.default.find();
        for (const match of matches) {
            if (match.type === constants_1.MATCH_TYPES.TOURNAMENT) {
                yield match.populate("tournament");
            }
        }
        res.status(200).json(matches);
    }
    catch (error) {
        const err = error;
        res
            .status(400)
            .json({ message: "Error al obtener los partidos", error: { message: err.message } });
    }
});
exports.getMatches = getMatches;
const getInProgressMatches = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const matches = yield Match_1.default.find({ status: constants_1.MATCH_STATUS.IN_PROGRESS }).sort({
            createdAt: -1
        });
        for (const match of matches) {
            if (match.type === constants_1.MATCH_TYPES.TOURNAMENT) {
                yield match.populate("tournament");
            }
        }
        res.status(200).json(matches);
    }
    catch (error) {
        const err = error;
        res
            .status(400)
            .json({ message: "Error al obtener los partidos en curso", error: { message: err.message } });
    }
});
exports.getInProgressMatches = getInProgressMatches;
const getMatchById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            res
                .status(400)
                .json({ message: "ID de partido inválido", error: { id: req.params.id } });
            return;
        }
        const match = yield Match_1.default.findById(req.params.id);
        if (!match) {
            res
                .status(404)
                .json({ message: "Partido no encontrado", error: { id: req.params.id } });
            return;
        }
        res.status(200).json(match);
    }
    catch (error) {
        const err = error;
        res
            .status(400)
            .json({ message: "Error al obtener el partido", error: { message: err.message } });
    }
});
exports.getMatchById = getMatchById;
const advanceWinnerLoser = (current) => __awaiter(void 0, void 0, void 0, function* () {
    if (!current.winner || !current.losingTeam)
        return;
    const enrichTeam = (id) => {
        const t = current.teams.find((x) => x.teamId.toString() === id.toString());
        if (!t)
            return null;
        return {
            teamId: t.teamId,
            score: 0,
            players: t.players.map((p) => ({
                playerId: p.playerId,
                username: p.username,
                isGuest: !!p.isGuest
            }))
        };
    };
    const winnerTeam = enrichTeam(current.winner);
    const loserTeam = enrichTeam(current.losingTeam);
    const propagate = (targetId, team) => __awaiter(void 0, void 0, void 0, function* () {
        if (!targetId || !team)
            return;
        const target = yield Match_1.default.findById(targetId);
        if (!target)
            return;
        const already = target.teams.some((t) => t.teamId.toString() === team.teamId.toString());
        if (already)
            return;
        target.teams.push(team);
        if (target.teams.length === 2 && target.status === constants_1.MATCH_STATUS.PENDING) {
            target.status = constants_1.MATCH_STATUS.IN_PROGRESS;
        }
        yield target.save();
    });
    yield propagate(current.feedsWinnerTo, winnerTeam);
    yield propagate(current.feedsLoserTo, loserTeam);
});
const updateMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { teams, winner, status } = req.body;
        const match = yield Match_1.default.findById(req.params.id);
        if (!match) {
            return void res.status(404).json({ message: "Partido no encontrado" });
        }
        if (!(yield canModifyMatch(match, req.user))) {
            return void res.status(403).json({ message: "No tenés permiso para modificar este partido" });
        }
        if (match.status === constants_1.MATCH_STATUS.FINISHED && status !== undefined) {
            return void res.status(409).json({ message: "El partido ya está finalizado" });
        }
        if (Array.isArray(teams)) {
            for (const t of teams) {
                if (typeof t.score === "number" && (t.score < 0 || t.score > constants_1.MAX_SCORE)) {
                    return void res.status(400).json({
                        message: `Score inválido (debe estar entre 0 y ${constants_1.MAX_SCORE})`
                    });
                }
            }
            const reachingMax = teams.filter((t) => t.score === constants_1.MAX_SCORE).length;
            if (reachingMax > 1) {
                res
                    .status(400)
                    .json({ message: "Dos equipos no pueden alcanzar el máximo simultáneamente" });
                return;
            }
            match.teams = teams;
        }
        if (status === constants_1.MATCH_STATUS.IN_PROGRESS) {
            if (match.status === constants_1.MATCH_STATUS.PENDING && match.teams.length < 2) {
                res
                    .status(400)
                    .json({ message: "El partido no puede iniciar sin los 2 equipos asignados" });
                return;
            }
            match.status = constants_1.MATCH_STATUS.IN_PROGRESS;
        }
        if (status === constants_1.MATCH_STATUS.FINISHED) {
            if (!winner) {
                return void res.status(400).json({ message: "Falta el winner para finalizar" });
            }
            const winnerInTeams = match.teams.some((t) => t.teamId.toString() === winner.toString());
            if (!winnerInTeams) {
                res
                    .status(400)
                    .json({ message: "El winner debe ser uno de los equipos del partido" });
                return;
            }
            match.winner = new mongoose_1.default.Types.ObjectId(winner);
            const loser = match.teams.find((t) => t.teamId.toString() !== winner.toString());
            if (loser)
                match.losingTeam = loser.teamId;
            match.status = constants_1.MATCH_STATUS.FINISHED;
        }
        yield match.save();
        if (match.status === constants_1.MATCH_STATUS.FINISHED && match.type === constants_1.MATCH_TYPES.TOURNAMENT) {
            yield advanceWinnerLoser(match);
            if (match.tournament && match.bracketSlot && TERMINAL_SLOTS.has(match.bracketSlot)) {
                const remaining = yield Match_1.default.countDocuments({
                    tournament: match.tournament,
                    bracketSlot: { $in: Array.from(TERMINAL_SLOTS) },
                    status: { $ne: constants_1.MATCH_STATUS.FINISHED }
                });
                if (remaining === 0) {
                    yield (0, tournament_controller_1.closeTournament)(match.tournament);
                }
            }
        }
        res.status(200).json(match);
    }
    catch (error) {
        const err = error;
        res
            .status(400)
            .json({ message: "Error al actualizar el partido", error: { message: err.message } });
    }
});
exports.updateMatch = updateMatch;
const updateMatchScore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { scores } = req.body;
        if (!Array.isArray(scores) || scores.length === 0) {
            return void res.status(400).json({ message: "El campo 'scores' debe ser un array no vacío" });
        }
        const match = yield Match_1.default.findById(req.params.id);
        if (!match) {
            return void res.status(404).json({ message: "Partido no encontrado" });
        }
        if (!(yield canModifyMatch(match, req.user))) {
            return void res.status(403).json({ message: "No tenés permiso para modificar este partido" });
        }
        if (match.status === constants_1.MATCH_STATUS.FINISHED) {
            return void res.status(409).json({ message: "El partido ya está finalizado" });
        }
        for (const s of scores) {
            if (typeof s.score !== "number" || s.score < 0 || s.score > constants_1.MAX_SCORE) {
                return void res.status(400).json({
                    message: `Score inválido (debe estar entre 0 y ${constants_1.MAX_SCORE})`
                });
            }
        }
        const reachingMax = scores.filter((s) => s.score === constants_1.MAX_SCORE).length;
        if (reachingMax > 1) {
            return void res
                .status(400)
                .json({ message: "Dos equipos no pueden alcanzar el máximo simultáneamente" });
        }
        for (const s of scores) {
            const team = match.teams.find((t) => t.teamId.toString() === s.teamId.toString());
            if (!team) {
                return void res.status(400).json({
                    message: "teamId no pertenece a este partido",
                    error: { teamId: s.teamId }
                });
            }
            team.score = s.score;
        }
        yield match.save();
        res.status(200).json(match);
    }
    catch (error) {
        const err = error;
        res
            .status(400)
            .json({ message: "Error al actualizar el marcador", error: { message: err.message } });
    }
});
exports.updateMatchScore = updateMatchScore;
const deleteMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const match = yield Match_1.default.findById(req.params.id);
        if (!match) {
            return void res.status(404).json({ message: "Partido no encontrado" });
        }
        if (!(yield canModifyMatch(match, req.user))) {
            return void res.status(403).json({ message: "No tenés permiso para eliminar este partido" });
        }
        if (match.tournament) {
            const tournament = yield Tournament_1.default.findById(match.tournament);
            if (tournament && tournament.status === "in_progress") {
                return void res.status(400).json({
                    message: "No se pueden borrar partidos de un torneo en curso"
                });
            }
        }
        yield match.deleteOne();
        res.status(200).json({ message: "Partido eliminado correctamente" });
    }
    catch (error) {
        const err = error;
        res
            .status(400)
            .json({ message: "Error al eliminar el partido", error: { message: err.message } });
    }
});
exports.deleteMatch = deleteMatch;
const getMatchesByTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId } = req.params;
        const matches = yield Match_1.default.find({ tournament: tournamentId });
        const formattedMatches = matches.map((match) => (Object.assign({ _id: match._id, type: match.type, status: match.status, tournament: match.tournament, teams: match.teams, winner: match.winner, losingTeam: match.losingTeam, bracketSlot: match.bracketSlot, feedsWinnerTo: match.feedsWinnerTo, feedsLoserTo: match.feedsLoserTo }, (match.type === "tournament" && match.phase ? { phase: match.phase } : {}))));
        res.json(formattedMatches);
    }
    catch (error) {
        console.error("Error al obtener partidos del torneo:", error);
        res.status(500).json({ message: "Error al obtener los partidos del torneo" });
    }
});
exports.getMatchesByTournament = getMatchesByTournament;
