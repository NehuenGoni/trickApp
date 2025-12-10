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
exports.getLeagueStandings = exports.updateUserLeaguePoints = exports.addTournamentToLeague = exports.getLeagueById = exports.getLeagues = exports.createLeague = void 0;
const League_1 = __importDefault(require("../models/League"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
// Crear una nueva liga
const createLeague = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, startDate, endDate } = req.body;
        const createdBy = req.user;
        const league = new League_1.default({
            name,
            description,
            startDate,
            endDate,
            createdBy,
            tournaments: [],
            userStats: []
        });
        yield league.save();
        res.status(201).json(league);
    }
    catch (error) {
        res.status(400).json({ message: "Error al crear la liga", error });
    }
});
exports.createLeague = createLeague;
// Obtener todas las ligas
const getLeagues = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const leagues = yield League_1.default.find()
            .populate("tournaments")
            .populate("userStats.userId", "username");
        res.status(200).json(leagues);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener las ligas", error });
    }
});
exports.getLeagues = getLeagues;
// Obtener una liga específica
const getLeagueById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const league = yield League_1.default.findById(req.params.id)
            .populate("tournaments")
            .populate("userStats.userId", "username");
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        res.status(200).json(league);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener la liga", error });
    }
});
exports.getLeagueById = getLeagueById;
// Agregar un torneo a una liga
const addTournamentToLeague = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { leagueId, tournamentId } = req.body;
        const league = yield League_1.default.findById(leagueId);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            res.status(404).json({ message: "Torneo no encontrado" });
            return;
        }
        if (league.tournaments.includes(tournamentId)) {
            res.status(400).json({ message: "El torneo ya está en la liga" });
            return;
        }
        league.tournaments.push(tournamentId);
        yield league.save();
        res.status(200).json({ message: "Torneo agregado a la liga", league });
    }
    catch (error) {
        res.status(400).json({ message: "Error al agregar el torneo a la liga", error });
    }
});
exports.addTournamentToLeague = addTournamentToLeague;
// Actualizar puntos de un usuario en una liga
const updateUserLeaguePoints = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { leagueId, userId, points, wins = 0, losses = 0 } = req.body;
        const league = yield League_1.default.findById(leagueId);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        const userStats = league.userStats.find(stats => stats.userId.toString() === userId);
        if (userStats) {
            // Actualizar estadísticas existentes
            userStats.points += points;
            userStats.wins += wins;
            userStats.losses += losses;
            userStats.tournamentsPlayed = Math.max(userStats.tournamentsPlayed, league.tournaments.length);
        }
        else {
            // Crear nuevas estadísticas para el usuario
            league.userStats.push({
                userId,
                points,
                wins,
                losses,
                tournamentsPlayed: 1
            });
        }
        yield league.save();
        res.status(200).json({ message: "Puntos actualizados", league });
    }
    catch (error) {
        res.status(400).json({ message: "Error al actualizar los puntos", error });
    }
});
exports.updateUserLeaguePoints = updateUserLeaguePoints;
// Obtener tabla de posiciones de una liga
const getLeagueStandings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const league = yield League_1.default.findById(req.params.id)
            .populate("userStats.userId", "username");
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        const standings = league.userStats
            .sort((a, b) => b.points - a.points)
            .map((stats, index) => ({
            position: index + 1,
            username: stats.userId.username,
            points: stats.points,
            tournamentsPlayed: stats.tournamentsPlayed,
            wins: stats.wins,
            losses: stats.losses
        }));
        res.status(200).json(standings);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener la tabla de posiciones", error });
    }
});
exports.getLeagueStandings = getLeagueStandings;
