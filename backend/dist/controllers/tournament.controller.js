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
exports.removeTeam = exports.updateTeam = exports.createTeamInTournament = exports.addPlayerToTournament = exports.deleteTournament = exports.updateTournament = exports.getTournamentById = exports.getTournaments = exports.createTournament = void 0;
const User_1 = __importDefault(require("../models/User"));
const mongoose_1 = __importDefault(require("mongoose"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const createTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, startDate, description, players } = req.body;
    const createdBy = req.user;
    try {
        const tournament = new Tournament_1.default({
            name,
            startDate,
            description,
            players,
            createdBy,
            status: 'upcoming'
        });
        yield tournament.save();
        res.status(201).json(tournament);
    }
    catch (error) {
        res.status(400).json({ message: "Error al crear el torneo", error });
    }
});
exports.createTournament = createTournament;
const getTournaments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournaments = yield Tournament_1.default.find();
        res.status(200).json(tournaments);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener los torneos", error });
    }
});
exports.getTournaments = getTournaments;
const getTournamentById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournament = yield Tournament_1.default.findById(req.params.id);
        if (!tournament) {
            res.status(404).json({ message: "Torneo no encontrado" });
            return;
        }
        res.status(200).json(tournament);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener el torneo", error });
    }
});
exports.getTournamentById = getTournamentById;
const updateTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const updatedTournament = yield Tournament_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true });
        console.log(req.params.id);
        if (!updatedTournament) {
            res.status(404).json({ message: "Torneo no encontrado" });
            return;
        }
        res.status(200).json(updatedTournament);
    }
    catch (error) {
        res.status(400).json({ message: "Error al actualizar el torneo", error });
    }
});
exports.updateTournament = updateTournament;
const deleteTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deletedTournament = yield Tournament_1.default.findByIdAndDelete(req.params.id);
        if (!deletedTournament) {
            res.status(404).json({ message: "Torneo no encontrado" });
            return;
        }
        res.status(200).json({ message: "Torneo eliminado con éxito" });
    }
    catch (error) {
        res.status(400).json({ message: "Error al eliminar el torneo", error });
    }
});
exports.deleteTournament = deleteTournament;
const addPlayerToTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, playerId } = req.body;
        // Verificar si el torneo existe
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ message: "Torneo no encontrado" });
        }
        // Verificar si el usuario existe
        const player = yield User_1.default.findById(playerId);
        if (!player) {
            return res.status(404).json({ message: "Jugador no encontrado" });
        }
        // Verificar si el jugador ya está en el torneo
        if (tournament.teams.includes(playerId)) {
            return res.status(400).json({ message: "El jugador ya está en el torneo" });
        }
        // Agregar el jugador
        tournament.teams.push(playerId);
        yield tournament.save();
        res.status(200).json({ message: "Jugador agregado al torneo", tournament });
    }
    catch (error) {
        res.status(500).json({ message: "Error al agregar jugador", error });
    }
});
exports.addPlayerToTournament = addPlayerToTournament;
const createTeamInTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId } = req.params;
        const { name, members } = req.body;
        // verify tournament exists
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            res.status(404).json({ message: "Torneo no encontrado" });
            return;
        }
        // Create new team
        const newTeam = {
            teamId: new mongoose_1.default.Types.ObjectId(),
            name,
            players: members.map((member) => {
                var _a;
                return ({
                    _id: new mongoose_1.default.Types.ObjectId(),
                    playerId: member.playerId,
                    name: member.name,
                    isGuest: (_a = member.isGuest) !== null && _a !== void 0 ? _a : false
                });
            })
        };
        tournament.teams.push(newTeam);
        yield tournament.save();
        res.status(201).json({ message: "Equipo creado en el torneo", team: newTeam });
    }
    catch (error) {
        res.status(500).json({ message: "Error al crear equipo", error });
    }
});
exports.createTeamInTournament = createTeamInTournament;
const updateTeam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, teamId } = req.params;
        const { players } = req.body; // Nuevos jugadores del equipo
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            res.status(404).json({ message: "Torneo no encontrado." });
            return;
        }
        const teamIndex = tournament.teams.findIndex(team => team.teamId.toString() === teamId);
        if (teamIndex === -1) {
            res.status(404).json({ message: "Equipo no encontrado." });
            return;
        }
        tournament.teams[teamIndex].players = players;
        yield tournament.save();
        res.status(200).json({ message: "Equipo actualizado correctamente.", team: tournament.teams[teamIndex] });
    }
    catch (error) {
        res.status(500).json({ message: "Error al actualizar el equipo", error });
    }
});
exports.updateTeam = updateTeam;
const removeTeam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, teamId } = req.params;
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            res.status(404).json({ message: "Torneo no encontrado." });
            return;
        }
        tournament.teams = tournament.teams.filter(team => team.teamId.toString() !== teamId);
        yield tournament.save();
        res.status(200).json({ message: "Equipo eliminado correctamente." });
    }
    catch (error) {
        res.status(500).json({ message: "Error al eliminar el equipo", error });
    }
});
exports.removeTeam = removeTeam;
