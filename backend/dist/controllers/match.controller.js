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
exports.getMatchesByTournament = exports.deleteMatch = exports.updateMatch = exports.getMatchById = exports.getInProgressMatches = exports.getMatches = exports.createMatch = void 0;
const Match_1 = __importDefault(require("../models/Match"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const constants_1 = require("../config/constants");
const createMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournament, teams, type, phase } = req.body;
        if (!Array.isArray(teams)) {
            res.status(400).json({
                message: "El campo 'teams' debe ser un array",
                error: { received: teams }
            });
            return;
        }
        const isValidTeam = teams.every(team => team &&
            typeof team === "object" &&
            "teamId" in team &&
            "score" in team &&
            Array.isArray(team.players) &&
            team.players.every((p) => "playerId" in p));
        if (!isValidTeam) {
            res.status(400).json({
                message: "Cada equipo debe tener 'teamId' y 'score'",
                error: { received: teams }
            });
            return;
        }
        let matchData = {
            teams,
            status: constants_1.MATCH_STATUS.IN_PROGRESS,
            type
        };
        if (type === constants_1.MATCH_TYPES.TOURNAMENT) {
            if (!tournament) {
                res.status(400).json({
                    message: "Se requiere un torneo para partidos de tipo torneo",
                    error: { type, tournament }
                });
                return;
            }
            const tournamentData = yield Tournament_1.default.findById(tournament);
            if (!tournamentData) {
                res.status(404).json({
                    message: "Torneo no encontrado",
                    error: { tournamentId: tournament }
                });
                return;
            }
            matchData.type = constants_1.MATCH_TYPES.TOURNAMENT;
            if (phase) {
                matchData.phase = phase; // 👈 opcional
            }
            const match = new Match_1.default(matchData);
            yield match.save();
            tournamentData.matches.push(match._id);
            yield tournamentData.save();
            res.status(201).json(match);
        }
        else {
            matchData.type = constants_1.MATCH_TYPES.FRIENDLY;
            const match = new Match_1.default(matchData);
            yield match.save();
            res.status(201).json(match);
        }
    }
    catch (error) {
        res.status(400).json({
            message: "Error al crear el partido",
            error: {
                name: error.name,
                message: error.message
            }
        });
    }
});
exports.createMatch = createMatch;
const getMatches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const matches = yield Match_1.default.find();
        for (const match of matches) {
            if (match.type === constants_1.MATCH_TYPES.TOURNAMENT) {
                yield match.populate("tournament");
            }
            yield match.populate("teams.teamId");
        }
        res.status(200).json(matches);
    }
    catch (error) {
        res.status(400).json({
            message: "Error al obtener los partidos",
            error: {
                message: error.message
            }
        });
    }
});
exports.getMatches = getMatches;
const getInProgressMatches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const matches = yield Match_1.default.find({ status: constants_1.MATCH_STATUS.IN_PROGRESS })
            .sort({ createdAt: -1 });
        for (const match of matches) {
            if (match.type === constants_1.MATCH_TYPES.TOURNAMENT) {
                yield match.populate("tournament");
            }
            yield match.populate("teams.teamId");
        }
        res.status(200).json(matches);
    }
    catch (error) {
        res.status(400).json({
            message: "Error al obtener los partidos en curso",
            error: {
                message: error.message
            }
        });
    }
});
exports.getInProgressMatches = getInProgressMatches;
const getMatchById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({
                message: "ID de partido inválido",
                error: { id: req.params.id }
            });
            return;
        }
        const match = yield Match_1.default.findById(req.params.id);
        if (!match) {
            res.status(404).json({
                message: "Partido no encontrado",
                error: { id: req.params.id }
            });
            return;
        }
        res.status(200).json(match);
    }
    catch (error) {
        res.status(400).json({
            message: "Error al obtener el partido",
            error: {
                message: error.message
            }
        });
    }
});
exports.getMatchById = getMatchById;
const updateMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { teams, winner, status } = req.body;
        const match = yield Match_1.default.findByIdAndUpdate(req.params.id, { teams, winner, status }, { new: true });
        if (!match) {
            res.status(404).json({ message: "Partido no encontrado" });
            return;
        }
        res.status(200).json(match);
    }
    catch (error) {
        res.status(400).json({
            message: "Error al actualizar el partido",
            error: {
                message: error.message
            }
        });
    }
});
exports.updateMatch = updateMatch;
const deleteMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const match = yield Match_1.default.findByIdAndDelete(req.params.id);
        if (!match) {
            res.status(404).json({ message: "Partido no encontrado" });
            return;
        }
        res.status(200).json({ message: "Partido eliminado correctamente" });
    }
    catch (error) {
        res.status(400).json({
            message: "Error al eliminar el partido",
            error: {
                message: error.message
            }
        });
    }
});
exports.deleteMatch = deleteMatch;
const getMatchesByTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId } = req.params;
        const matches = yield Match_1.default.find({ tournament: tournamentId })
            .populate("teams.teamId", "name")
            .populate("teams.players.playerId");
        const formattedMatches = matches.map((match) => (Object.assign({ _id: match._id, type: match.type, status: match.status, tournament: match.tournament, teams: match.teams }, (match.type === "tournament" && match.phase ? { phase: match.phase } : {}))));
        res.json(formattedMatches);
    }
    catch (error) {
        console.error('Error al obtener partidos del torneo:', error);
        res.status(500).json({ message: 'Error al obtener los partidos del torneo' });
    }
});
exports.getMatchesByTournament = getMatchesByTournament;
