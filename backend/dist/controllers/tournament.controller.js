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
exports.closeTournament = exports.deleteTournamentCascade = exports.revertTournamentPoints = exports.awardTournamentPoints = exports.computePlayerStats = exports.getTournamentLeaderboard = exports.startTournament = exports.drawTournament = exports.replaceTournamentRoster = exports.creatorRemoveSignup = exports.creatorAddSignup = exports.addGuestTeam = exports.unregisterFromTournament = exports.registerToTournament = exports.removeTeam = exports.createTeamInTournament = exports.deleteTournament = exports.updateTournament = exports.getTournamentById = exports.getOpenTournaments = exports.getTournaments = exports.createTournament = exports.buildDrawnTeams = exports.removeSignupsFromTournament = exports.countFilledSlots = exports.resolveTournamentLeague = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const Match_1 = __importDefault(require("../models/Match"));
const League_1 = __importDefault(require("../models/League"));
const leaguePermissions_1 = require("../utils/leaguePermissions");
const Tournament_1 = __importDefault(require("../models/Tournament"));
const TournamentLogo_1 = __importDefault(require("../models/TournamentLogo"));
const constants_1 = require("../config/constants");
const withTransaction_1 = require("../utils/withTransaction");
const roster_1 = require("../utils/roster");
const isValidTournamentType = (value) => value === constants_1.TOURNAMENT_TYPES.GRAND_SLAM || value === constants_1.TOURNAMENT_TYPES.MASTER_1000;
const isValidFormat = (value) => value === constants_1.TOURNAMENT_FORMATS.DUOS || value === constants_1.TOURNAMENT_FORMATS.TRIOS;
const isValidFormationMode = (value) => Object.values(constants_1.TEAM_FORMATION_MODES).includes(value);
const isValidGuestDrawMode = (value) => value === constants_1.GUEST_DRAW_MODES.GROUPED || value === constants_1.GUEST_DRAW_MODES.MIXED;
/**
 * Resuelve y valida el `league` opcional que puede venir en el body al crear
 * o editar un torneo. `null`/`""` desvincula. Devuelve `undefined` si el
 * campo no vino (no tocar), o `{ error }` si algo no es válido.
 *
 * Asignar un torneo a una liga es una mutación de LIGA, así que pasa por el
 * mismo gate que el resto de la administración de ligas (`canManageLeague`)
 * — si no, el chequeo de permisos que vive en league.controller.ts se podría
 * esquivar creando o editando el torneo directamente.
 */
const resolveTournamentLeague = (rawLeague, authUser) => __awaiter(void 0, void 0, void 0, function* () {
    if (rawLeague === null || rawLeague === "") {
        return { league: null };
    }
    if (typeof rawLeague !== "string" || !mongoose_1.default.isValidObjectId(rawLeague)) {
        return { error: "ID de liga inválido", status: 400 };
    }
    const league = yield League_1.default.findById(rawLeague).select("createdBy");
    if (!league) {
        return { error: "Liga no encontrada", status: 404 };
    }
    if (!(0, leaguePermissions_1.canManageLeague)(authUser, league)) {
        return { error: "No tenés permisos para asignar torneos a esta liga", status: 403 };
    }
    return { league: league._id };
});
exports.resolveTournamentLeague = resolveTournamentLeague;
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
 * Cupos ocupados de un torneo. Espeja `slotsFilled` de TournamentDetails.tsx:
 * en los modos con pool (random, creator-formed) los equipos derivados de él
 * (`isDrawn`) no se suman aparte, sus jugadores ya están contados ahí; solo
 * suman los equipos "fijos" cargados enteros a mano (`addGuestTeam`).
 */
const countFilledSlots = (tournament) => {
    const size = constants_1.FORMAT_TEAM_SIZE[tournament.format];
    if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.USER_FORMED) {
        return tournament.teams.length * size;
    }
    return (tournament.individualSignups.length +
        tournament.teams.filter((t) => !t.isDrawn).length * size);
};
exports.countFilledSlots = countFilledSlots;
/**
 * Saca del pool a los inscriptos que cumplan `predicate` y también de
 * cualquier equipo en el que ya estuvieran. Sin esto, quitar del pool a
 * alguien ya sorteado/asignado deja un jugador fantasma: sigue apareciendo en
 * el cuadro pero ya no está inscripto. Los equipos que quedan vacíos se
 * eliminan; los que quedan incompletos se dejan así (el gate de "cupos
 * completos" no deja iniciar el torneo).
 */
const removeSignupsFromTournament = (tournament, predicate) => {
    const toRemove = tournament.individualSignups.filter(predicate);
    if (toRemove.length === 0) {
        return { removed: 0, teamsTouched: 0, teamsDropped: 0 };
    }
    const removedKeys = new Set(toRemove.map((s) => (0, roster_1.playerKey)(s)));
    tournament.individualSignups = tournament.individualSignups.filter((s) => !removedKeys.has((0, roster_1.playerKey)(s)));
    let teamsTouched = 0;
    let teamsDropped = 0;
    const survivingTeams = [];
    for (const team of tournament.teams) {
        const before = team.players.length;
        const players = team.players.filter((p) => !removedKeys.has((0, roster_1.playerKey)(p)));
        if (players.length !== before)
            teamsTouched++;
        if (players.length === 0 && before > 0) {
            teamsDropped++;
            continue;
        }
        team.players = players;
        survivingTeams.push(team);
    }
    tournament.teams = survivingTeams;
    if (teamsDropped > 0) {
        tournament.draftPairOrder = undefined;
    }
    return { removed: toRemove.length, teamsTouched, teamsDropped };
};
exports.removeSignupsFromTournament = removeSignupsFromTournament;
/**
 * Arma los equipos faltantes a partir de los inscriptos individuales. El criterio
 * para los invitados depende de `guestDrawMode`:
 * - `grouped`: se agrupan entre ellos y van al frente de la lista antes de cortar
 *   en bloques secuenciales, así que los primeros equipos salen 100% invitados, a
 *   lo sumo uno queda mixto (el que absorbe el resto de la división) y ningún
 *   equipo posterior lleva invitados.
 * - `mixed`: entran al pool general y se barajan junto con los registrados, así
 *   que pueden quedar dispersos en cualquier equipo.
 */
const buildDrawnTeams = (signups, expectedSize, teamsNeeded, existingTeamsCount, guestDrawMode) => {
    const ordered = guestDrawMode === constants_1.GUEST_DRAW_MODES.MIXED
        ? shuffle(signups)
        : [
            ...shuffle(signups.filter((s) => s.isGuest)),
            ...shuffle(signups.filter((s) => !s.isGuest))
        ];
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
                isGuest: s.isGuest,
                signupId: s.signupId
            })),
            isDrawn: true
        });
    }
    return newTeams;
};
exports.buildDrawnTeams = buildDrawnTeams;
const createTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, startDate, description, type, format, teamFormationMode, guestDrawMode, league: rawLeague } = req.body;
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
    if (guestDrawMode !== undefined && !isValidGuestDrawMode(guestDrawMode)) {
        return void res.status(400).json({ message: "Modo de agrupación de invitados inválido (grouped | mixed)" });
    }
    let league = null;
    if (rawLeague !== undefined) {
        const resolved = yield (0, exports.resolveTournamentLeague)(rawLeague, req.authUser);
        if ("error" in resolved) {
            return void res.status(resolved.status).json({ message: resolved.error });
        }
        league = resolved.league;
    }
    try {
        const tournament = new Tournament_1.default(Object.assign(Object.assign({ name,
            startDate,
            description,
            type,
            format,
            teamFormationMode }, (guestDrawMode !== undefined ? { guestDrawMode } : {})), { createdBy, status: "upcoming", teams: [], individualSignups: [], matches: [], playerStats: [], pointsAwarded: false, league }));
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
        const tournaments = yield Tournament_1.default.find().sort({ createdAt: -1 }).populate("league", "name");
        res.status(200).json(tournaments);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener los torneos", error });
    }
});
exports.getTournaments = getTournaments;
const getOpenTournaments = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournaments = yield Tournament_1.default.find({ status: "upcoming" })
            .sort({ createdAt: -1 })
            .populate("league", "name");
        res.status(200).json(tournaments);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener los torneos abiertos", error });
    }
});
exports.getOpenTournaments = getOpenTournaments;
const getTournamentById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournament = yield Tournament_1.default.findById(req.params.id).populate("league", "name");
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
        if (req.body.league !== undefined) {
            const resolved = yield (0, exports.resolveTournamentLeague)(req.body.league, req.authUser);
            if ("error" in resolved) {
                return void res.status(resolved.status).json({ message: resolved.error });
            }
            tournament.league = resolved.league;
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
        // Mismo criterio que `deleteMatch`: si no se puede borrar un partido de un
        // torneo en curso, tampoco el torneo entero. El admin sí puede.
        if (tournament.status === "in_progress") {
            return void res.status(400).json({
                message: "No se puede borrar un torneo en curso"
            });
        }
        const { deletedMatches } = yield (0, withTransaction_1.withTransaction)((session) => (0, exports.deleteTournamentCascade)(tournament, session));
        res.status(200).json({
            message: `Torneo eliminado junto con ${deletedMatches} partido(s).`
        });
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
        const expectedSize = constants_1.FORMAT_TEAM_SIZE[tournament.format];
        const targetSignups = constants_1.TOURNAMENT_TEAMS_COUNT * expectedSize;
        if ((0, exports.countFilledSlots)(tournament) >= targetSignups) {
            return void res.status(400).json({ message: "El torneo ya está completo" });
        }
        // Los equipos fijos (cargados enteros a mano) también ocupan cupo aunque no
        // estén en `individualSignups`, así que el tope efectivo del pool es
        // `targetSignups` menos lo que ya ocupan esos equipos fijos.
        const fixedSlots = tournament.teams.filter((t) => !t.isDrawn).length * expectedSize;
        const signupCap = targetSignups - fixedSlots;
        const userDoc = yield User_1.default.findById(userId);
        if (!userDoc) {
            return void res.status(404).json({ message: "Usuario no encontrado" });
        }
        const result = yield Tournament_1.default.updateOne({
            _id: tournament._id,
            status: "upcoming",
            $expr: { $lt: [{ $size: "$individualSignups" }, signupCap] },
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
        const { removed } = (0, exports.removeSignupsFromTournament)(tournament, (s) => !!s.userId && s.userId.toString() === userId);
        if (removed === 0) {
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
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.CREATOR_FORMED) {
            return void res.status(400).json({
                message: "En este modo agregá jugadores al torneo y después armá los equipos"
            });
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
            const taken = (0, exports.countFilledSlots)(tournament);
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
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.USER_FORMED) {
            return void res.status(400).json({
                message: "Este endpoint no aplica en modo 'user-formed'. Usá POST /:tournamentId/teams"
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
        const taken = (0, exports.countFilledSlots)(tournament);
        if (taken + incoming > targetSignups) {
            return void res.status(400).json({
                message: `Cupos insuficientes: quedan ${targetSignups - taken} lugares`
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
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.USER_FORMED) {
            return void res.status(400).json({
                message: "Este endpoint no aplica en modo 'user-formed'. Usá DELETE /:tournamentId/teams/:teamId"
            });
        }
        const { removed, teamsTouched, teamsDropped } = (0, exports.removeSignupsFromTournament)(tournament, (s) => s.signupId.toString() === signupId);
        if (removed === 0) {
            return void res.status(404).json({ message: "El inscripto no existe" });
        }
        yield tournament.save();
        const incompleteRemaining = teamsTouched - teamsDropped;
        res.status(200).json({
            message: incompleteRemaining > 0
                ? `Jugador quitado del torneo. Quedó ${incompleteRemaining} equipo(s) incompleto(s).`
                : "Jugador quitado del torneo"
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al quitar jugador", error });
    }
});
exports.creatorRemoveSignup = creatorRemoveSignup;
/**
 * Reemplaza de una vez la composición de los equipos editables del torneo
 * (el "roster editor" de mover/intercambiar jugadores). No agrega ni quita
 * gente del torneo, solo reparte: la validación central es que el
 * multiconjunto de jugadores del payload coincida con el universo movible
 * (ver `validateRosterPayload`). Preserva los cruces guardados
 * (`draftPairOrder`) salvo que haya cambiado el conjunto de equipos.
 */
const replaceTournamentRoster = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.createdBy.toString() !== req.user) {
            return void res.status(403).json({ message: "Solo el creador puede reorganizar los equipos" });
        }
        if (tournament.status !== "upcoming") {
            return void res.status(400).json({
                message: "Solo se pueden reorganizar los equipos de un torneo que aún no comenzó"
            });
        }
        const result = (0, roster_1.validateRosterPayload)({
            payload: req.body,
            teamFormationMode: tournament.teamFormationMode,
            teamSize: constants_1.FORMAT_TEAM_SIZE[tournament.format],
            existingTeams: tournament.teams,
            individualSignups: tournament.individualSignups
        });
        if (!result.ok) {
            return void res.status(result.status).json({ message: result.error });
        }
        tournament.teams = result.teams;
        tournament.rosterEditedAt = new Date();
        if (result.draftInvalidated) {
            tournament.draftPairOrder = undefined;
        }
        yield tournament.save();
        res.status(200).json({
            message: "Equipos actualizados",
            teams: tournament.teams,
            draftInvalidated: result.draftInvalidated
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al reorganizar los equipos", error });
    }
});
exports.replaceTournamentRoster = replaceTournamentRoster;
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
        if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.RANDOM) {
            // Solo en random el sorteo rearma los equipos desde cero: descarta el
            // sorteo previo (pero preserva los equipos fijos, que no tienen isDrawn)
            // y vuelve a repartir el pool. En los otros modos los equipos ya están
            // armados (por los jugadores o a mano) y este endpoint solo sortea los
            // cruces, así que NO hay que tocar `tournament.teams` acá.
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
            const drawnTeams = (0, exports.buildDrawnTeams)(tournament.individualSignups, expectedSize, teamsNeeded, tournament.teams.length, tournament.guestDrawMode);
            tournament.teams.push(...drawnTeams);
            // Se rearmaron los equipos desde cero: cualquier edición manual previa
            // ya no aplica.
            tournament.rosterEditedAt = undefined;
        }
        else {
            if (tournament.teams.length !== constants_1.TOURNAMENT_TEAMS_COUNT) {
                return void res.status(400).json({
                    message: `Faltan equipos: ${tournament.teams.length}/${constants_1.TOURNAMENT_TEAMS_COUNT}`
                });
            }
            if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.CREATOR_FORMED) {
                const incomplete = tournament.teams.some((t) => t.players.length !== expectedSize);
                if (incomplete) {
                    return void res.status(400).json({
                        message: "Todos los equipos deben estar completos antes de sortear los cruces"
                    });
                }
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
                const drawnTeams = (0, exports.buildDrawnTeams)(tournament.individualSignups, expectedSize, teamsNeeded, tournament.teams.length, tournament.guestDrawMode);
                tournament.teams.push(...drawnTeams);
            }
            else {
                if (tournament.teams.length !== constants_1.TOURNAMENT_TEAMS_COUNT) {
                    return void res.status(400).json({
                        message: `Faltan equipos: ${tournament.teams.length}/${constants_1.TOURNAMENT_TEAMS_COUNT}`
                    });
                }
                if (tournament.teamFormationMode === constants_1.TEAM_FORMATION_MODES.CREATOR_FORMED) {
                    const incomplete = tournament.teams.some((t) => t.players.length !== expectedSize);
                    if (incomplete) {
                        return void res.status(400).json({
                            message: "Todos los equipos deben estar completos antes de iniciar"
                        });
                    }
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
        tournament.rosterEditedAt = undefined;
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
const awardTournamentPoints = (tournament, session) => __awaiter(void 0, void 0, void 0, function* () {
    if (tournament.pointsAwarded)
        return;
    for (const s of tournament.playerStats) {
        if (s.isGuest || !s.playerId)
            continue;
        if (s.points <= 0)
            continue;
        yield User_1.default.updateOne({ _id: s.playerId }, { $inc: { totalPoints: s.points } }, { session });
    }
    tournament.pointsAwarded = true;
});
exports.awardTournamentPoints = awardTournamentPoints;
/**
 * Descuenta del ranking global los puntos que este torneo había otorgado.
 * Usa un pipeline de update para que `totalPoints` nunca quede negativo.
 * No persiste el torneo.
 */
const revertTournamentPoints = (tournament, session) => __awaiter(void 0, void 0, void 0, function* () {
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
        ], { session });
    }
    tournament.pointsAwarded = false;
});
exports.revertTournamentPoints = revertTournamentPoints;
/**
 * Borra el torneo y todo lo que lo referencia: los puntos que repartió al
 * ranking global y sus partidos. Lo embebido en el documento (equipos,
 * inscriptos, `playerStats`) se va con él.
 *
 * No hace falta tocar ninguna liga: el vínculo torneo↔liga vive en
 * `Tournament.league` (no en un array del lado de la liga), así que muere
 * junto con el documento sin ningún paso extra. La tabla de posiciones de la
 * liga es derivada (`computeLeagueStandings`), así que se corrige sola en la
 * próxima lectura.
 *
 * No abre transacción por su cuenta: quien la llame debería envolverla en
 * `withTransaction` y pasarle la sesión.
 */
const deleteTournamentCascade = (tournament, session) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    yield (0, exports.revertTournamentPoints)(tournament, session);
    const deleted = yield Match_1.default.deleteMany({ tournament: tournament._id }, { session });
    // El logo vive en su propia colección, así que no se va con el documento del
    // torneo: sin este borrado quedan binarios huérfanos en Mongo para siempre.
    yield TournamentLogo_1.default.deleteOne({ tournamentId: tournament._id }, { session });
    yield tournament.deleteOne({ session });
    return {
        deletedMatches: (_a = deleted.deletedCount) !== null && _a !== void 0 ? _a : 0
    };
});
exports.deleteTournamentCascade = deleteTournamentCascade;
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
