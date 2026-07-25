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
exports.closeTournament = exports.revertTournamentPoints = exports.awardTournamentPoints = exports.computePlayerStats = exports.getTournamentLeaderboard = exports.startTournament = exports.drawTournament = exports.creatorRemoveSignup = exports.creatorAddSignup = exports.addGuestTeam = exports.unregisterFromTournament = exports.registerToTournament = exports.removeTeam = exports.updateTeam = exports.createTeamInTournament = exports.deleteTournament = exports.updateTournament = exports.getTournamentById = exports.getOpenTournaments = exports.getTournaments = exports.createTournament = exports.buildDrawnTeams = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const Match_1 = __importDefault(require("../models/Match"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const constants_1 = require("../config/constants");
const isValidTournamentType = (value) => value === constants_1.TOURNAMENT_TYPES.GRAND_SLAM || value === constants_1.TOURNAMENT_TYPES.MASTER_1000;
const isValidFormat = (value) => value === constants_1.TOURNAMENT_FORMATS.DUOS || value === constants_1.TOURNAMENT_FORMATS.TRIOS;
const isValidFormationMode = (value) => value === constants_1.TEAM_FORMATION_MODES.USER_FORMED ||
    value === constants_1.TEAM_FORMATION_MODES.RANDOM;
const shuffle = (arr) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};
const isUserAlreadyInTournament = (tournament, userId) => {
    const inSignups = tournament.individualSignups.some((s) => s.userId && s.userId.toString() === userId);
    if (inSignups)
        return true;
    return tournament.teams.some((t) => t.players.some((p) => p.playerId && p.playerId.toString() === userId));
};
/**
 * Arma los equipos faltantes a partir de los inscriptos individuales, agrupando
 * primero a los invitados entre ellos. El corte en bloques es secuencial, así que
 * los invitados barajados van al frente de la lista: los primeros equipos salen
 * 100% invitados, a lo sumo uno queda mixto (el que absorbe el resto de la
 * división) y ningún equipo posterior lleva invitados.
 */
const buildDrawnTeams = (signups, expectedSize, teamsNeeded, existingTeamsCount) => {
    const guests = signups.filter((s) => s.isGuest);
    const registered = signups.filter((s) => !s.isGuest);
    const ordered = [...shuffle(guests), ...shuffle(registered)];
    const newTeams = [];
    let cursor = 0;
    for (let i = 0; i < teamsNeeded; i++) {
        const players = ordered.slice(cursor, cursor + expectedSize);
        cursor += expectedSize;
        const teamNumber = existingTeamsCount + newTeams.length + 1;
        newTeams.push({
            teamId: new mongoose_1.default.Types.ObjectId(),
            name: `Equipo ${teamNumber}`,
            players: players.map((s) => ({
                playerId: s.userId,
                name: s.name,
                isGuest: s.isGuest
            })),
            isDrawn: true
        });
    }
    return newTeams;
};
exports.buildDrawnTeams = buildDrawnTeams;
const createTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, startDate, description, type, format, teamFormationMode } = req.body;
    const createdBy = req.user;
    if (!isValidTournamentType(type)) {
        return void res.status(400).json({ message: "Tipo de torneo inválido (grand-slam | master-1000)" });
    }
    if (!isValidFormat(format)) {
        return void res.status(400).json({ message: "Formato inválido (duos | trios)" });
    }
    if (!isValidFormationMode(teamFormationMode)) {
        return void res.status(400).json({ message: "Modo de formación de equipos inválido" });
    }
    try {
        const tournament = new Tournament_1.default({
            name,
            startDate,
            description,
            type,
            format,
            teamFormationMode,
            createdBy,
            status: "upcoming",
            teams: [],
            individualSignups: [],
            matches: [],
            playerStats: [],
            pointsAwarded: false
        });
        yield tournament.save();
        res.status(201).json(tournament);
    }
    catch (error) {
        res.status(400).json({ message: "Error al crear el torneo", error });
    }
});
exports.createTournament = createTournament;
const getTournaments = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournaments = yield Tournament_1.default.find().sort({ createdAt: -1 });
        res.status(200).json(tournaments);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener los torneos", error });
    }
});
exports.getTournaments = getTournaments;
const getOpenTournaments = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournaments = yield Tournament_1.default.find({ status: "upcoming" }).sort({
            createdAt: -1
        });
        res.status(200).json(tournaments);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener los torneos abiertos", error });
    }
});
exports.getOpenTournaments = getOpenTournaments;
const getTournamentById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournament = yield Tournament_1.default.findById(req.params.id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
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
        const tournament = yield Tournament_1.default.findById(req.params.id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.createdBy.toString() !== req.user) {
            return void res.status(403).json({ message: "Solo el creador puede modificar el torneo" });
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({
                message: "Solo se puede modificar un torneo que aún no comenzó"
            });
        }
        const allowed = ["name", "description", "startDate"];
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                tournament[key] = req.body[key];
            }
        }
        yield tournament.save();
        res.status(200).json(tournament);
    }
    catch (error) {
        res.status(400).json({ message: "Error al actualizar el torneo", error });
    }
});
exports.updateTournament = updateTournament;
const deleteTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournament = yield Tournament_1.default.findById(req.params.id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.createdBy.toString() !== req.user) {
            return void res.status(403).json({ message: "Solo el creador puede borrar el torneo" });
        }
        yield Match_1.default.deleteMany({ tournament: tournament._id });
        yield tournament.deleteOne();
        res.status(200).json({ message: "Torneo eliminado con éxito" });
    }
    catch (error) {
        res.status(400).json({ message: "Error al eliminar el torneo", error });
    }
});
exports.deleteTournament = deleteTournament;
const createTeamInTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId } = req.params;
        const { name, members } = req.body;
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.status !== "upcoming") {
            res
                .status(400)
                .json({ message: "No se pueden agregar equipos a un torneo iniciado o finalizado" });
            return;
        }
        if (tournament.teams.length >= constants_1.TOURNAMENT_TEAMS_COUNT) {
            return void res.status(400).json({ message: "El torneo ya tiene los 8 equipos completos" });
        }
        const expectedSize = constants_1.FORMAT_TEAM_SIZE[tournament.format];
        if (!Array.isArray(members) || members.length !== expectedSize) {
            return void res.status(400).json({
                message: `El equipo debe tener ${expectedSize} jugadores (formato ${tournament.format})`
            });
        }
        for (const member of members) {
            if (!member.isGuest && member.playerId) {
                const inOther = tournament.teams.some((t) => t.players.some((p) => p.playerId && p.playerId.toString() === member.playerId.toString()));
                if (inOther) {
                    return void res.status(400).json({
                        message: `El jugador ${member.name || member.playerId} ya está en otro equipo de este torneo`
                    });
                }
            }
        }
        const newTeam = {
            teamId: new mongoose_1.default.Types.ObjectId(),
            name,
            registeredBy: req.user ? new mongoose_1.default.Types.ObjectId(req.user) : undefined,
            players: members.map((member) => ({
                playerId: member.playerId
                    ? new mongoose_1.default.Types.ObjectId(member.playerId)
                    : undefined,
                name: member.name,
                isGuest: !!member.isGuest
            }))
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
        const { players } = req.body;
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado." });
        }
        if (tournament.status !== "upcoming") {
            res
                .status(400)
                .json({ message: "No se pueden modificar equipos en un torneo iniciado" });
            return;
        }
        const teamIndex = tournament.teams.findIndex((team) => team.teamId.toString() === teamId);
        if (teamIndex === -1) {
            return void res.status(404).json({ message: "Equipo no encontrado." });
        }
        tournament.teams[teamIndex].players = players;
        yield tournament.save();
        res.status(200).json({
            message: "Equipo actualizado correctamente.",
            team: tournament.teams[teamIndex]
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al actualizar el equipo", error });
    }
});
exports.updateTeam = updateTeam;
const removeTeam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { tournamentId, teamId } = req.params;
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado." });
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({
                message: "No se pueden quitar equipos de un torneo iniciado"
            });
        }
        const team = tournament.teams.find((t) => t.teamId.toString() === teamId);
        if (!team) {
            return void res.status(404).json({ message: "Equipo no encontrado." });
        }
        const isCreator = tournament.createdBy.toString() === req.user;
        const isCaptain = ((_a = team.registeredBy) === null || _a === void 0 ? void 0 : _a.toString()) === req.user;
        if (!isCreator && !isCaptain) {
            return void res.status(403).json({
                message: "Solo el creador del torneo o quien inscribió el equipo puede eliminarlo"
            });
        }
        tournament.teams = tournament.teams.filter((t) => t.teamId.toString() !== teamId);
        yield tournament.save();
        res.status(200).json({ message: "Equipo eliminado correctamente." });
    }
    catch (error) {
        res.status(500).json({ message: "Error al eliminar el equipo", error });
    }
});
exports.removeTeam = removeTeam;
const registerToTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user;
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.status !== "upcoming") {
            res
                .status(400)
                .json({ message: "Las inscripciones están cerradas para este torneo" });
            return;
        }
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.USER_FORMED) {
            const { teamName, memberUserIds } = req.body;
            if (!teamName || typeof teamName !== "string") {
                return void res.status(400).json({ message: "Falta el nombre del equipo" });
            }
            if (!Array.isArray(memberUserIds) || memberUserIds.length === 0) {
                return void res.status(400).json({ message: "Falta la lista de miembros" });
            }
            const expectedSize = constants_1.FORMAT_TEAM_SIZE[tournament.format];
            if (memberUserIds.length !== expectedSize) {
                return void res.status(400).json({
                    message: `El equipo debe tener ${expectedSize} jugadores (formato ${tournament.format})`
                });
            }
            if (!memberUserIds.includes(userId)) {
                return void res.status(400).json({
                    message: "Quien se inscribe debe ser parte del equipo"
                });
            }
            const uniqueIds = new Set(memberUserIds);
            if (uniqueIds.size !== memberUserIds.length) {
                return void res.status(400).json({ message: "Hay miembros duplicados en el equipo" });
            }
            if (tournament.teams.length >= constants_1.TOURNAMENT_TEAMS_COUNT) {
                return void res.status(400).json({ message: "El torneo ya está completo" });
            }
            for (const memberId of memberUserIds) {
                const inOther = tournament.teams.some((t) => t.players.some((p) => p.playerId && p.playerId.toString() === memberId));
                if (inOther) {
                    return void res.status(400).json({
                        message: "Uno de los miembros ya está inscripto en otro equipo del torneo"
                    });
                }
            }
            const users = yield User_1.default.find({ _id: { $in: memberUserIds } });
            if (users.length !== memberUserIds.length) {
                return void res.status(400).json({ message: "Algún miembro no existe" });
            }
            const newTeam = {
                teamId: new mongoose_1.default.Types.ObjectId(),
                name: teamName,
                registeredBy: new mongoose_1.default.Types.ObjectId(userId),
                players: users.map((u) => ({
                    playerId: u._id,
                    name: u.username,
                    isGuest: false
                }))
            };
            const updateResult = yield Tournament_1.default.updateOne({
                _id: tournament._id,
                status: "upcoming",
                $expr: { $lt: [{ $size: "$teams" }, constants_1.TOURNAMENT_TEAMS_COUNT] }
            }, { $push: { teams: newTeam } });
            if (updateResult.modifiedCount === 0) {
                return void res.status(409).json({
                    message: "No se pudo inscribir el equipo (cupos llenos o estado cambió)"
                });
            }
            return void res.status(201).json({ message: "Equipo inscripto", team: newTeam });
        }
        if (isUserAlreadyInTournament(tournament, userId)) {
            return void res.status(400).json({ message: "Ya estás inscripto en este torneo" });
        }
        const targetSignups = constants_1.TOURNAMENT_TEAMS_COUNT * constants_1.FORMAT_TEAM_SIZE[tournament.format];
        if (tournament.individualSignups.length >= targetSignups) {
            return void res.status(400).json({ message: "El torneo ya está completo" });
        }
        const userDoc = yield User_1.default.findById(userId);
        if (!userDoc) {
            return void res.status(404).json({ message: "Usuario no encontrado" });
        }
        const result = yield Tournament_1.default.updateOne({
            _id: tournament._id,
            status: "upcoming",
            $expr: { $lt: [{ $size: "$individualSignups" }, targetSignups] },
            "individualSignups.userId": { $ne: new mongoose_1.default.Types.ObjectId(userId) }
        }, {
            $push: {
                individualSignups: {
                    signupId: new mongoose_1.default.Types.ObjectId(),
                    userId: new mongoose_1.default.Types.ObjectId(userId),
                    name: userDoc.username,
                    isGuest: false
                }
            }
        });
        if (result.modifiedCount === 0) {
            return void res.status(409).json({
                message: "No se pudo inscribir (cupos llenos, ya inscripto o estado cambió)"
            });
        }
        res.status(201).json({ message: "Inscripción registrada" });
    }
    catch (error) {
        res.status(500).json({ message: "Error al inscribirse al torneo", error });
    }
});
exports.registerToTournament = registerToTournament;
const unregisterFromTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user;
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.status !== "upcoming") {
            res
                .status(400)
                .json({ message: "No se puede desinscribir de un torneo iniciado o finalizado" });
            return;
        }
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.USER_FORMED) {
            const team = tournament.teams.find((t) => { var _a; return ((_a = t.registeredBy) === null || _a === void 0 ? void 0 : _a.toString()) === userId; });
            if (!team) {
                return void res.status(404).json({
                    message: "No tenés un equipo inscripto en este torneo"
                });
            }
            tournament.teams = tournament.teams.filter((t) => t.teamId.toString() !== team.teamId.toString());
            yield tournament.save();
            return void res.status(200).json({ message: "Equipo desinscripto" });
        }
        const before = tournament.individualSignups.length;
        tournament.individualSignups = tournament.individualSignups.filter((s) => !s.userId || s.userId.toString() !== userId);
        if (tournament.individualSignups.length === before) {
            return void res.status(404).json({ message: "No estás inscripto en este torneo" });
        }
        yield tournament.save();
        res.status(200).json({ message: "Desinscripción exitosa" });
    }
    catch (error) {
        res.status(500).json({ message: "Error al desinscribirse", error });
    }
});
exports.unregisterFromTournament = unregisterFromTournament;
const addGuestTeam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, members } = req.body;
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.createdBy.toString() !== req.user) {
            res
                .status(403)
                .json({ message: "Solo el creador puede agregar equipos de invitados" });
            return;
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({ message: "El torneo ya inició" });
        }
        if (!name || !Array.isArray(members) || members.length === 0) {
            return void res.status(400).json({ message: "Faltan datos del equipo" });
        }
        const expectedSize = constants_1.FORMAT_TEAM_SIZE[tournament.format];
        if (members.length !== expectedSize) {
            return void res.status(400).json({
                message: `El equipo debe tener ${expectedSize} jugadores (formato ${tournament.format})`
            });
        }
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.USER_FORMED) {
            if (tournament.teams.length >= constants_1.TOURNAMENT_TEAMS_COUNT) {
                return void res.status(400).json({ message: "Ya hay 8 equipos" });
            }
        }
        else {
            const target = constants_1.TOURNAMENT_TEAMS_COUNT * expectedSize;
            const fixedTeams = tournament.teams.filter((t) => !t.isDrawn).length;
            const taken = tournament.individualSignups.length + fixedTeams * expectedSize;
            if (taken + members.length > target) {
                return void res.status(400).json({
                    message: "Agregar este equipo excede los cupos del torneo"
                });
            }
        }
        const newTeam = {
            teamId: new mongoose_1.default.Types.ObjectId(),
            name,
            registeredBy: req.user ? new mongoose_1.default.Types.ObjectId(req.user) : undefined,
            players: members.map((m) => ({
                playerId: m.playerId ? new mongoose_1.default.Types.ObjectId(m.playerId) : undefined,
                name: m.name,
                isGuest: !!m.isGuest
            }))
        };
        tournament.teams.push(newTeam);
        yield tournament.save();
        res.status(201).json({ message: "Equipo de invitados agregado", team: newTeam });
    }
    catch (error) {
        res.status(500).json({ message: "Error al agregar equipo de invitados", error });
    }
});
exports.addGuestTeam = addGuestTeam;
const creatorAddSignup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { userId, userIds, guestNames } = req.body;
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament)
            return void res.status(404).json({ message: "Torneo no encontrado" });
        if (tournament.createdBy.toString() !== req.user) {
            return void res.status(403).json({ message: "Solo el creador puede inscribir jugadores" });
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({ message: "Las inscripciones están cerradas" });
        }
        if (tournament.teamFormationMode !== constants_1.TEAM_FORMATION_MODES.RANDOM) {
            return void res.status(400).json({
                message: "Este endpoint solo aplica en modo de equipos aleatorios. Para el modo 'user-formed' usá POST /:tournamentId/teams"
            });
        }
        // Compatibilidad con el body legado { userId } de un solo usuario.
        const allUserIds = [...(userIds !== null && userIds !== void 0 ? userIds : [])];
        if (userId)
            allUserIds.push(userId);
        const allGuestNames = (guestNames !== null && guestNames !== void 0 ? guestNames : []).map((n) => n.trim()).filter(Boolean);
        if (allUserIds.length === 0 && allGuestNames.length === 0) {
            return void res.status(400).json({ message: "Falta userId, userIds o guestNames" });
        }
        const uniqueUserIds = Array.from(new Set(allUserIds));
        const users = yield User_1.default.find({ _id: { $in: uniqueUserIds } });
        if (users.length !== uniqueUserIds.length) {
            return void res.status(404).json({ message: "Algún usuario no existe" });
        }
        const alreadyIn = new Set(tournament.individualSignups
            .filter((s) => s.userId)
            .map((s) => s.userId.toString()));
        const duplicate = uniqueUserIds.find((uid) => alreadyIn.has(uid));
        if (duplicate) {
            return void res.status(409).json({ message: "Un usuario ya está inscripto" });
        }
        const expectedSize = constants_1.FORMAT_TEAM_SIZE[tournament.format];
        const targetSignups = constants_1.TOURNAMENT_TEAMS_COUNT * expectedSize;
        const incoming = uniqueUserIds.length + allGuestNames.length;
        if (tournament.individualSignups.length + incoming > targetSignups) {
            return void res.status(400).json({
                message: `Cupos insuficientes: quedan ${targetSignups - tournament.individualSignups.length} lugares`
            });
        }
        const newSignups = [
            ...users.map((u) => ({
                signupId: new mongoose_1.default.Types.ObjectId(),
                userId: u._id,
                name: u.username,
                isGuest: false
            })),
            ...allGuestNames.map((name) => ({
                signupId: new mongoose_1.default.Types.ObjectId(),
                name,
                isGuest: true
            }))
        ];
        tournament.individualSignups.push(...newSignups);
        yield tournament.save();
        res.status(201).json({
            message: `${newSignups.length} inscripto(s) agregado(s)`,
            signups: newSignups
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al inscribir jugador", error });
    }
});
exports.creatorAddSignup = creatorAddSignup;
const creatorRemoveSignup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, signupId } = req.params;
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament)
            return void res.status(404).json({ message: "Torneo no encontrado" });
        if (tournament.createdBy.toString() !== req.user) {
            return void res.status(403).json({ message: "Solo el creador puede quitar jugadores" });
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({ message: "El torneo ya inició" });
        }
        if (tournament.teamFormationMode !== constants_1.TEAM_FORMATION_MODES.RANDOM) {
            return void res.status(400).json({
                message: "Este endpoint solo aplica en modo aleatorio. Para el modo 'user-formed' usá DELETE /:tournamentId/teams/:teamId"
            });
        }
        const before = tournament.individualSignups.length;
        tournament.individualSignups = tournament.individualSignups.filter((s) => s.signupId.toString() !== signupId);
        if (tournament.individualSignups.length === before) {
            return void res.status(404).json({ message: "El inscripto no existe" });
        }
        yield tournament.save();
        res.status(200).json({ message: "Jugador quitado del torneo" });
    }
    catch (error) {
        res.status(500).json({ message: "Error al quitar jugador", error });
    }
});
exports.creatorRemoveSignup = creatorRemoveSignup;
const BRACKET_TEMPLATES = [
    { bracketSlot: constants_1.BRACKET_SLOTS.QF1, phase: constants_1.MATCH_PHASES.QUARTER_FINALS },
    { bracketSlot: constants_1.BRACKET_SLOTS.QF2, phase: constants_1.MATCH_PHASES.QUARTER_FINALS },
    { bracketSlot: constants_1.BRACKET_SLOTS.QF3, phase: constants_1.MATCH_PHASES.QUARTER_FINALS },
    { bracketSlot: constants_1.BRACKET_SLOTS.QF4, phase: constants_1.MATCH_PHASES.QUARTER_FINALS },
    { bracketSlot: constants_1.BRACKET_SLOTS.SFG1, phase: constants_1.MATCH_PHASES.SEMIFINALS_GOLD },
    { bracketSlot: constants_1.BRACKET_SLOTS.SFG2, phase: constants_1.MATCH_PHASES.SEMIFINALS_GOLD },
    { bracketSlot: constants_1.BRACKET_SLOTS.SFS1, phase: constants_1.MATCH_PHASES.SEMIFINALS },
    { bracketSlot: constants_1.BRACKET_SLOTS.SFS2, phase: constants_1.MATCH_PHASES.SEMIFINALS },
    { bracketSlot: constants_1.BRACKET_SLOTS.FG, phase: constants_1.MATCH_PHASES.FINAL_GOLD },
    { bracketSlot: constants_1.BRACKET_SLOTS.FS, phase: constants_1.MATCH_PHASES.FINAL },
    { bracketSlot: constants_1.BRACKET_SLOTS.M34, phase: constants_1.MATCH_PHASES.THIRD_PLACE },
    { bracketSlot: constants_1.BRACKET_SLOTS.M78, phase: constants_1.MATCH_PHASES.SEVENTH_PLACE }
];
const FEED_MAP = {
    [constants_1.BRACKET_SLOTS.QF1]: { winnerTo: constants_1.BRACKET_SLOTS.SFG1, loserTo: constants_1.BRACKET_SLOTS.SFS1 },
    [constants_1.BRACKET_SLOTS.QF2]: { winnerTo: constants_1.BRACKET_SLOTS.SFG1, loserTo: constants_1.BRACKET_SLOTS.SFS1 },
    [constants_1.BRACKET_SLOTS.QF3]: { winnerTo: constants_1.BRACKET_SLOTS.SFG2, loserTo: constants_1.BRACKET_SLOTS.SFS2 },
    [constants_1.BRACKET_SLOTS.QF4]: { winnerTo: constants_1.BRACKET_SLOTS.SFG2, loserTo: constants_1.BRACKET_SLOTS.SFS2 },
    [constants_1.BRACKET_SLOTS.SFG1]: { winnerTo: constants_1.BRACKET_SLOTS.FG, loserTo: constants_1.BRACKET_SLOTS.M34 },
    [constants_1.BRACKET_SLOTS.SFG2]: { winnerTo: constants_1.BRACKET_SLOTS.FG, loserTo: constants_1.BRACKET_SLOTS.M34 },
    [constants_1.BRACKET_SLOTS.SFS1]: { winnerTo: constants_1.BRACKET_SLOTS.FS, loserTo: constants_1.BRACKET_SLOTS.M78 },
    [constants_1.BRACKET_SLOTS.SFS2]: { winnerTo: constants_1.BRACKET_SLOTS.FS, loserTo: constants_1.BRACKET_SLOTS.M78 }
};
const teamToMatchTeam = (team) => ({
    teamId: team.teamId,
    score: 0,
    players: team.players.map((p) => ({
        playerId: p.playerId,
        username: p.name,
        isGuest: !!p.isGuest
    }))
});
/**
 * Sortea (o re-sortea) el torneo sin iniciarlo: arma los equipos faltantes en modo
 * aleatorio y guarda un orden de cruces tentativo (`draftPairOrder`) para preview.
 * Descarta cualquier sorteo previo (equipos con `isDrawn`) pero preserva los
 * equipos que el creador haya precargado a mano. `individualSignups` NO se vacía:
 * es la fuente de verdad que permite re-sortear las veces que haga falta.
 */
const drawTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.createdBy.toString() !== req.user) {
            return void res.status(403).json({ message: "Solo el creador puede sortear el torneo" });
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({ message: "El torneo ya inició o finalizó" });
        }
        const expectedSize = constants_1.FORMAT_TEAM_SIZE[tournament.format];
        tournament.teams = tournament.teams.filter((t) => !t.isDrawn);
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.RANDOM) {
            const totalSlots = constants_1.TOURNAMENT_TEAMS_COUNT * expectedSize;
            const filledFromTeams = tournament.teams.length * expectedSize;
            const filledFromSignups = tournament.individualSignups.length;
            if (filledFromTeams + filledFromSignups !== totalSlots) {
                return void res.status(400).json({
                    message: `Faltan jugadores: ${filledFromTeams + filledFromSignups}/${totalSlots}`
                });
            }
            const teamsNeeded = constants_1.TOURNAMENT_TEAMS_COUNT - tournament.teams.length;
            const drawnTeams = (0, exports.buildDrawnTeams)(tournament.individualSignups, expectedSize, teamsNeeded, tournament.teams.length);
            tournament.teams.push(...drawnTeams);
        }
        else {
            if (tournament.teams.length !== constants_1.TOURNAMENT_TEAMS_COUNT) {
                return void res.status(400).json({
                    message: `Faltan equipos: ${tournament.teams.length}/${constants_1.TOURNAMENT_TEAMS_COUNT}`
                });
            }
        }
        const draftPairOrder = shuffle(tournament.teams).map((t) => t.teamId);
        tournament.draftPairOrder = draftPairOrder;
        yield tournament.save();
        const pairOrderTeams = draftPairOrder.map((tid) => tournament.teams.find((t) => t.teamId.toString() === tid.toString()));
        const pairings = [constants_1.BRACKET_SLOTS.QF1, constants_1.BRACKET_SLOTS.QF2, constants_1.BRACKET_SLOTS.QF3, constants_1.BRACKET_SLOTS.QF4].map((slot, i) => ({
            slot,
            teamIds: [pairOrderTeams[i * 2].teamId, pairOrderTeams[i * 2 + 1].teamId]
        }));
        res.status(200).json({ teams: tournament.teams, pairings });
    }
    catch (error) {
        res.status(500).json({ message: "Error al sortear el torneo", error });
    }
});
exports.drawTournament = drawTournament;
const startTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { mode, pairings } = req.body;
        if (mode !== "random" && mode !== "manual") {
            return void res.status(400).json({ message: "Modo inválido (random | manual)" });
        }
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.createdBy.toString() !== req.user) {
            return void res.status(403).json({ message: "Solo el creador puede iniciar el torneo" });
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({ message: "El torneo ya inició o finalizó" });
        }
        const expectedSize = constants_1.FORMAT_TEAM_SIZE[tournament.format];
        const hasDraft = Array.isArray(tournament.draftPairOrder) &&
            tournament.draftPairOrder.length === constants_1.TOURNAMENT_TEAMS_COUNT;
        // Si ya se sorteó desde /draw, los equipos están armados y no hay que tocar nada acá.
        // Si no (alguien inicia sin pasar por el preview), se arma inline como antes.
        if (!hasDraft) {
            if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.RANDOM) {
                tournament.teams = tournament.teams.filter((t) => !t.isDrawn);
                const totalSlots = constants_1.TOURNAMENT_TEAMS_COUNT * expectedSize;
                const filledFromTeams = tournament.teams.length * expectedSize;
                const filledFromSignups = tournament.individualSignups.length;
                if (filledFromTeams + filledFromSignups !== totalSlots) {
                    return void res.status(400).json({
                        message: `Faltan jugadores: ${filledFromTeams + filledFromSignups}/${totalSlots}`
                    });
                }
                const teamsNeeded = constants_1.TOURNAMENT_TEAMS_COUNT - tournament.teams.length;
                const drawnTeams = (0, exports.buildDrawnTeams)(tournament.individualSignups, expectedSize, teamsNeeded, tournament.teams.length);
                tournament.teams.push(...drawnTeams);
            }
            else {
                if (tournament.teams.length !== constants_1.TOURNAMENT_TEAMS_COUNT) {
                    return void res.status(400).json({
                        message: `Faltan equipos: ${tournament.teams.length}/${constants_1.TOURNAMENT_TEAMS_COUNT}`
                    });
                }
            }
        }
        let pairOrder;
        if (mode === "random" && hasDraft) {
            pairOrder = tournament
                .draftPairOrder.map((tid) => tournament.teams.find((t) => t.teamId.toString() === tid.toString()))
                .filter((t) => !!t);
            if (pairOrder.length !== constants_1.TOURNAMENT_TEAMS_COUNT) {
                return void res.status(400).json({
                    message: "El sorteo guardado no coincide con los equipos actuales, volvé a sortear"
                });
            }
        }
        else if (mode === "random") {
            pairOrder = shuffle(tournament.teams);
        }
        else {
            if (!Array.isArray(pairings) || pairings.length !== 4) {
                return void res.status(400).json({
                    message: "pairings debe tener 4 entradas (QF1..QF4)"
                });
            }
            const expectedSlots = [
                constants_1.BRACKET_SLOTS.QF1,
                constants_1.BRACKET_SLOTS.QF2,
                constants_1.BRACKET_SLOTS.QF3,
                constants_1.BRACKET_SLOTS.QF4
            ];
            const seen = new Set();
            const pairOrderTmp = [];
            for (const slot of expectedSlots) {
                const entry = pairings.find((p) => p.slot === slot);
                if (!entry) {
                    return void res.status(400).json({ message: `Falta el slot ${slot} en pairings` });
                }
                if (!Array.isArray(entry.teamIds) || entry.teamIds.length !== 2) {
                    res
                        .status(400)
                        .json({ message: `El slot ${slot} debe tener exactamente 2 teamIds` });
                    return;
                }
                for (const tid of entry.teamIds) {
                    if (seen.has(tid)) {
                        return void res.status(400).json({ message: `teamId duplicado: ${tid}` });
                    }
                    seen.add(tid);
                    const team = tournament.teams.find((t) => t.teamId.toString() === tid);
                    if (!team) {
                        res
                            .status(400)
                            .json({ message: `teamId no pertenece al torneo: ${tid}` });
                        return;
                    }
                    pairOrderTmp.push(team);
                }
            }
            if (seen.size !== constants_1.TOURNAMENT_TEAMS_COUNT) {
                return void res.status(400).json({
                    message: "pairings debe incluir los 8 equipos sin duplicados"
                });
            }
            pairOrder = pairOrderTmp;
        }
        const slotToMatchId = new Map();
        for (const tpl of BRACKET_TEMPLATES) {
            const isQF = tpl.phase === constants_1.MATCH_PHASES.QUARTER_FINALS;
            const slotIndex = tpl.bracketSlot === constants_1.BRACKET_SLOTS.QF1
                ? 0
                : tpl.bracketSlot === constants_1.BRACKET_SLOTS.QF2
                    ? 1
                    : tpl.bracketSlot === constants_1.BRACKET_SLOTS.QF3
                        ? 2
                        : 3;
            const teamsForMatch = isQF
                ? [pairOrder[slotIndex * 2], pairOrder[slotIndex * 2 + 1]].map(teamToMatchTeam)
                : [];
            const m = yield Match_1.default.create({
                tournament: tournament._id,
                teams: teamsForMatch,
                status: isQF ? constants_1.MATCH_STATUS.IN_PROGRESS : constants_1.MATCH_STATUS.PENDING,
                type: constants_1.MATCH_TYPES.TOURNAMENT,
                phase: tpl.phase,
                bracketSlot: tpl.bracketSlot
            });
            slotToMatchId.set(tpl.bracketSlot, m._id);
        }
        for (const [slot, feeds] of Object.entries(FEED_MAP)) {
            const matchId = slotToMatchId.get(slot);
            if (!matchId)
                continue;
            const update = {};
            if (feeds.winnerTo)
                update.feedsWinnerTo = slotToMatchId.get(feeds.winnerTo);
            if (feeds.loserTo)
                update.feedsLoserTo = slotToMatchId.get(feeds.loserTo);
            if (Object.keys(update).length > 0) {
                yield Match_1.default.updateOne({ _id: matchId }, { $set: update });
            }
        }
        tournament.matches = Array.from(slotToMatchId.values());
        tournament.individualSignups = [];
        tournament.draftPairOrder = undefined;
        tournament.status = "in_progress";
        yield tournament.save();
        res.status(200).json({ message: "Torneo iniciado", tournament });
    }
    catch (error) {
        console.error("Error iniciando torneo:", error);
        res.status(500).json({ message: "Error al iniciar el torneo", error });
    }
});
exports.startTournament = startTournament;
const getTournamentLeaderboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournament = yield Tournament_1.default.findById(req.params.id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        const sorted = [...tournament.playerStats].sort((a, b) => a.position - b.position);
        res.status(200).json({ status: tournament.status, playerStats: sorted });
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener el ranking", error });
    }
});
exports.getTournamentLeaderboard = getTournamentLeaderboard;
const positionFromMatch = (bracketSlot, isWinner) => {
    if (bracketSlot === constants_1.BRACKET_SLOTS.FG)
        return isWinner ? 1 : 2;
    if (bracketSlot === constants_1.BRACKET_SLOTS.M34)
        return isWinner ? 3 : 4;
    if (bracketSlot === constants_1.BRACKET_SLOTS.FS)
        return isWinner ? 5 : 6;
    if (bracketSlot === constants_1.BRACKET_SLOTS.M78)
        return isWinner ? 7 : 8;
    return null;
};
const computePlayerStats = (tournament) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const matches = yield Match_1.default.find({ tournament: tournament._id });
    const stats = [];
    const points = constants_1.POINTS_TABLE[tournament.type];
    if (!points)
        return stats;
    for (const m of matches) {
        if (!m.bracketSlot)
            continue;
        if (m.status !== constants_1.MATCH_STATUS.FINISHED)
            continue;
        if (!m.winner || !m.losingTeam)
            continue;
        const winnerPos = positionFromMatch(m.bracketSlot, true);
        const loserPos = positionFromMatch(m.bracketSlot, false);
        if (winnerPos === null || loserPos === null)
            continue;
        const teamWinner = m.teams.find((t) => t.teamId.toString() === m.winner.toString());
        const teamLoser = m.teams.find((t) => t.teamId.toString() === m.losingTeam.toString());
        if (teamWinner) {
            for (const p of teamWinner.players) {
                stats.push({
                    playerId: p.playerId,
                    name: p.username || "Invitado",
                    isGuest: !!p.isGuest,
                    position: winnerPos,
                    points: (_a = points[winnerPos]) !== null && _a !== void 0 ? _a : 0
                });
            }
        }
        if (teamLoser) {
            for (const p of teamLoser.players) {
                stats.push({
                    playerId: p.playerId,
                    name: p.username || "Invitado",
                    isGuest: !!p.isGuest,
                    position: loserPos,
                    points: (_b = points[loserPos]) !== null && _b !== void 0 ? _b : 0
                });
            }
        }
    }
    return stats;
});
exports.computePlayerStats = computePlayerStats;
/** Suma al ranking global los puntos de `playerStats`. No persiste el torneo. */
const awardTournamentPoints = (tournament) => __awaiter(void 0, void 0, void 0, function* () {
    if (tournament.pointsAwarded)
        return;
    for (const s of tournament.playerStats) {
        if (s.isGuest || !s.playerId)
            continue;
        if (s.points <= 0)
            continue;
        yield User_1.default.updateOne({ _id: s.playerId }, { $inc: { totalPoints: s.points } });
    }
    tournament.pointsAwarded = true;
});
exports.awardTournamentPoints = awardTournamentPoints;
/**
 * Descuenta del ranking global los puntos que este torneo había otorgado.
 * Usa un pipeline de update para que `totalPoints` nunca quede negativo.
 * No persiste el torneo.
 */
const revertTournamentPoints = (tournament) => __awaiter(void 0, void 0, void 0, function* () {
    if (!tournament.pointsAwarded)
        return;
    for (const s of tournament.playerStats) {
        if (s.isGuest || !s.playerId)
            continue;
        if (s.points <= 0)
            continue;
        yield User_1.default.updateOne({ _id: s.playerId }, [
            {
                $set: {
                    totalPoints: {
                        $max: [0, { $subtract: [{ $ifNull: ["$totalPoints", 0] }, s.points] }]
                    }
                }
            }
        ]);
    }
    tournament.pointsAwarded = false;
});
exports.revertTournamentPoints = revertTournamentPoints;
const closeTournament = (tournamentId) => __awaiter(void 0, void 0, void 0, function* () {
    const tournament = yield Tournament_1.default.findById(tournamentId);
    if (!tournament)
        return;
    if (tournament.pointsAwarded)
        return;
    if (tournament.status === "completed")
        return;
    tournament.playerStats = yield (0, exports.computePlayerStats)(tournament);
    tournament.status = "completed";
    yield (0, exports.awardTournamentPoints)(tournament);
    yield tournament.save();
});
exports.closeTournament = closeTournament;
