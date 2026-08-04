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
exports.getAdminStats = exports.deleteMatch = exports.updateMatch = exports.getTournamentMatches = exports.deleteTournament = exports.recalculateTournamentPoints = exports.forceCloseTournament = exports.resetTournament = exports.updateTournament = exports.listTournaments = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const Match_1 = __importDefault(require("../models/Match"));
const User_1 = __importDefault(require("../models/User"));
const constants_1 = require("../config/constants");
const tournament_controller_1 = require("./tournament.controller");
const withTransaction_1 = require("../utils/withTransaction");
const TOURNAMENT_STATUSES = ["upcoming", "in_progress", "completed"];
const listTournaments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const search = (_a = req.query.search) === null || _a === void 0 ? void 0 : _a.trim();
        const status = req.query.status;
        const filter = {};
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.name = { $regex: escaped, $options: "i" };
        }
        if (status && TOURNAMENT_STATUSES.includes(status)) {
            filter.status = status;
        }
        const league = req.query.league;
        if (league && mongoose_1.default.isValidObjectId(league)) {
            filter.league = league;
        }
        const [tournaments, total] = yield Promise.all([
            Tournament_1.default.find(filter)
                .populate("createdBy", "username email")
                .populate("league", "name")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Tournament_1.default.countDocuments(filter)
        ]);
        res.status(200).json({
            tournaments,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al listar torneos", error: error.message });
    }
});
exports.listTournaments = listTournaments;
/**
 * Edición sin las restricciones de creador/estado del endpoint público.
 * El estado no se cambia acá: para eso están /reset y /close, que además
 * ajustan partidos y puntos.
 */
const updateTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de torneo inválido" });
        }
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        const { name, description, startDate, type, format, teamFormationMode, league } = req.body;
        if (league !== undefined) {
            const resolved = yield (0, tournament_controller_1.resolveTournamentLeague)(league, req.authUser);
            if ("error" in resolved) {
                return void res.status(resolved.status).json({ message: resolved.error });
            }
            tournament.league = resolved.league;
        }
        if (name !== undefined) {
            if (!name.trim()) {
                return void res.status(400).json({ message: "El nombre no puede estar vacío" });
            }
            tournament.name = name.trim();
        }
        if (description !== undefined)
            tournament.description = description;
        if (startDate !== undefined) {
            const parsed = new Date(startDate);
            if (Number.isNaN(parsed.getTime())) {
                return void res.status(400).json({ message: "Fecha de inicio inválida" });
            }
            tournament.startDate = parsed;
        }
        let typeChanged = false;
        if (type !== undefined) {
            if (!Object.values(constants_1.TOURNAMENT_TYPES).includes(type)) {
                return void res.status(400).json({
                    message: "Tipo de torneo inválido (grand-slam | master-1000)"
                });
            }
            typeChanged = tournament.type !== type;
            tournament.type = type;
        }
        if (format !== undefined) {
            if (!Object.values(constants_1.TOURNAMENT_FORMATS).includes(format)) {
                return void res.status(400).json({ message: "Formato inválido (duos | trios)" });
            }
            const hasParticipants = tournament.teams.length > 0 || tournament.individualSignups.length > 0;
            if (format !== tournament.format && hasParticipants) {
                return void res.status(400).json({
                    message: "No se puede cambiar el formato con equipos o inscriptos cargados: cambiaría el tamaño de los equipos"
                });
            }
            tournament.format = format;
        }
        if (teamFormationMode !== undefined) {
            if (!Object.values(constants_1.TEAM_FORMATION_MODES).includes(teamFormationMode)) {
                return void res.status(400).json({ message: "Modo de formación inválido" });
            }
            const hasParticipants = tournament.teams.length > 0 || tournament.individualSignups.length > 0;
            if (teamFormationMode !== tournament.teamFormationMode && hasParticipants) {
                return void res.status(400).json({
                    message: "No se puede cambiar el modo de formación con equipos o inscriptos cargados"
                });
            }
            tournament.teamFormationMode = teamFormationMode;
        }
        // Cambiar el tipo cambia la tabla de puntos: si ya se repartieron, se recalculan.
        let recalculated = false;
        if (typeChanged && tournament.pointsAwarded) {
            yield (0, tournament_controller_1.revertTournamentPoints)(tournament);
            tournament.playerStats = yield (0, tournament_controller_1.computePlayerStats)(tournament);
            yield (0, tournament_controller_1.awardTournamentPoints)(tournament);
            recalculated = true;
        }
        yield tournament.save();
        res.status(200).json({
            message: recalculated
                ? "Torneo actualizado. Se recalcularon los puntos por el cambio de tipo."
                : "Torneo actualizado",
            tournament
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al actualizar el torneo", error: error.message });
    }
});
exports.updateTournament = updateTournament;
/**
 * Devuelve el torneo al estado de inscripciones: borra los partidos generados,
 * limpia el ranking y descuenta del ranking global los puntos ya otorgados.
 */
const resetTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { unmakeTeams } = req.body;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de torneo inválido" });
        }
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        yield (0, tournament_controller_1.revertTournamentPoints)(tournament);
        const deleted = yield Match_1.default.deleteMany({ tournament: tournament._id });
        tournament.matches = [];
        tournament.playerStats = [];
        tournament.status = "upcoming";
        tournament.draftPairOrder = undefined;
        let signupsRestored = 0;
        if (unmakeTeams) {
            if (tournament.teamFormationMode !== constants_1.TEAM_FORMATION_MODES.USER_FORMED) {
                // random y creator-formed: los equipos derivados del pool (isDrawn) se
                // deshacen y sus jugadores vuelven a la lista de inscriptos; los
                // equipos cargados enteros a mano (`addGuestTeam`) se conservan.
                const drawn = tournament.teams.filter((t) => t.isDrawn);
                const restored = [];
                for (const team of drawn) {
                    for (const player of team.players) {
                        restored.push({
                            signupId: new mongoose_1.default.Types.ObjectId(),
                            userId: player.playerId,
                            name: player.name,
                            isGuest: !!player.isGuest
                        });
                    }
                }
                tournament.teams = tournament.teams.filter((t) => !t.isDrawn);
                tournament.individualSignups.push(...restored);
                signupsRestored = restored.length;
            }
            else {
                tournament.teams = [];
            }
        }
        yield tournament.save();
        res.status(200).json({
            message: `Torneo reseteado a inscripciones abiertas. Se eliminaron ${deleted.deletedCount} partido(s)${signupsRestored ? ` y se devolvieron ${signupsRestored} jugador(es) a la lista de inscriptos` : ""}.`,
            tournament
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al resetear el torneo", error: error.message });
    }
});
exports.resetTournament = resetTournament;
/** Cierra el torneo con los resultados que haya, aunque el cuadro esté incompleto. */
const forceCloseTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de torneo inválido" });
        }
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (tournament.status === "completed" && tournament.pointsAwarded) {
            return void res.status(400).json({
                message: "El torneo ya está finalizado. Usá 'Recalcular puntos' si necesitás corregirlo."
            });
        }
        tournament.playerStats = yield (0, tournament_controller_1.computePlayerStats)(tournament);
        tournament.status = "completed";
        yield (0, tournament_controller_1.awardTournamentPoints)(tournament);
        yield tournament.save();
        res.status(200).json({
            message: `Torneo cerrado. Se repartieron puntos a ${tournament.playerStats.filter((s) => !s.isGuest && s.playerId).length} jugador(es).`,
            tournament
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al cerrar el torneo", error: error.message });
    }
});
exports.forceCloseTournament = forceCloseTournament;
/** Revierte los puntos otorgados y los vuelve a calcular desde los partidos. */
const recalculateTournamentPoints = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de torneo inválido" });
        }
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        yield (0, tournament_controller_1.revertTournamentPoints)(tournament);
        tournament.playerStats = yield (0, tournament_controller_1.computePlayerStats)(tournament);
        yield (0, tournament_controller_1.awardTournamentPoints)(tournament);
        yield tournament.save();
        res.status(200).json({
            message: "Puntos recalculados",
            playerStats: [...tournament.playerStats].sort((a, b) => a.position - b.position)
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al recalcular los puntos", error: error.message });
    }
});
exports.recalculateTournamentPoints = recalculateTournamentPoints;
const deleteTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de torneo inválido" });
        }
        const tournament = yield Tournament_1.default.findById(id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        // La cascada descuenta los puntos ya otorgados. Si el torneo pertenecía a
        // una liga, esta se corrige sola: su tabla de posiciones es derivada, no
        // hace falta ningún paso extra acá (ver deleteTournamentCascade).
        const { deletedMatches } = yield (0, withTransaction_1.withTransaction)((session) => (0, tournament_controller_1.deleteTournamentCascade)(tournament, session));
        res.status(200).json({
            message: `Torneo "${tournament.name}" eliminado junto con ${deletedMatches} partido(s).`
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al eliminar el torneo", error: error.message });
    }
});
exports.deleteTournament = deleteTournament;
const getTournamentMatches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de torneo inválido" });
        }
        const matches = yield Match_1.default.find({ tournament: id }).sort({ createdAt: 1 });
        res.status(200).json(matches);
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener los partidos", error: error.message });
    }
});
exports.getTournamentMatches = getTournamentMatches;
/**
 * Deshace la propagación de un partido ya finalizado: saca los equipos que había
 * empujado a las siguientes rondas y, si esas rondas ya se habían jugado, las
 * revierte también en cascada. El cuadro tiene 3 niveles, así que la recursión
 * está acotada.
 */
const rollbackDownstream = (match) => __awaiter(void 0, void 0, void 0, function* () {
    let reverted = 0;
    const detach = (targetId, teamId) => __awaiter(void 0, void 0, void 0, function* () {
        if (!targetId || !teamId)
            return;
        const target = yield Match_1.default.findById(targetId);
        if (!target)
            return;
        const hadTeam = target.teams.some((t) => t.teamId.toString() === teamId.toString());
        if (!hadTeam)
            return;
        if (target.status === constants_1.MATCH_STATUS.FINISHED) {
            reverted += yield rollbackDownstream(target);
            target.winner = undefined;
            target.losingTeam = undefined;
        }
        target.teams = target.teams.filter((t) => t.teamId.toString() !== teamId.toString());
        target.status = target.teams.length === 2 ? constants_1.MATCH_STATUS.IN_PROGRESS : constants_1.MATCH_STATUS.PENDING;
        for (const t of target.teams)
            t.score = 0;
        yield target.save();
        reverted += 1;
    });
    yield detach(match.feedsWinnerTo, match.winner);
    yield detach(match.feedsLoserTo, match.losingTeam);
    return reverted;
});
const propagateResult = (match) => __awaiter(void 0, void 0, void 0, function* () {
    if (!match.winner || !match.losingTeam)
        return;
    const buildTeam = (id) => {
        const t = match.teams.find((x) => x.teamId.toString() === id.toString());
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
    const push = (targetId, team) => __awaiter(void 0, void 0, void 0, function* () {
        if (!targetId || !team)
            return;
        const target = yield Match_1.default.findById(targetId);
        if (!target)
            return;
        if (target.teams.some((t) => t.teamId.toString() === team.teamId.toString()))
            return;
        target.teams.push(team);
        if (target.teams.length === 2 && target.status === constants_1.MATCH_STATUS.PENDING) {
            target.status = constants_1.MATCH_STATUS.IN_PROGRESS;
        }
        yield target.save();
    });
    yield push(match.feedsWinnerTo, buildTeam(match.winner));
    yield push(match.feedsLoserTo, buildTeam(match.losingTeam));
});
/**
 * Corrige un partido sin importar su estado. Si cambia el ganador de un partido
 * ya finalizado, revierte el cuadro aguas abajo y vuelve a propagar; si el torneo
 * estaba cerrado, devuelve los puntos y lo reabre.
 */
const updateMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const { scores, winner, status } = req.body;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de partido inválido" });
        }
        const match = yield Match_1.default.findById(id);
        if (!match) {
            return void res.status(404).json({ message: "Partido no encontrado" });
        }
        if (status !== undefined && !Object.values(constants_1.MATCH_STATUS).includes(status)) {
            return void res.status(400).json({
                message: `Estado inválido (${Object.values(constants_1.MATCH_STATUS).join(" | ")})`
            });
        }
        if (Array.isArray(scores)) {
            for (const s of scores) {
                if (typeof s.score !== "number" || s.score < 0 || s.score > constants_1.MAX_SCORE) {
                    return void res.status(400).json({
                        message: `Score inválido (debe estar entre 0 y ${constants_1.MAX_SCORE})`
                    });
                }
                const team = match.teams.find((t) => t.teamId.toString() === s.teamId.toString());
                if (!team) {
                    return void res.status(400).json({
                        message: "teamId no pertenece a este partido",
                        error: { teamId: s.teamId }
                    });
                }
                team.score = s.score;
            }
        }
        // Snapshot previo a mutar el partido: es lo que necesita el rollback del cuadro.
        const previous = {
            winner: match.winner,
            losingTeam: match.losingTeam,
            feedsWinnerTo: match.feedsWinnerTo,
            feedsLoserTo: match.feedsLoserTo
        };
        const previousWinner = (_a = match.winner) === null || _a === void 0 ? void 0 : _a.toString();
        const previousStatus = match.status;
        const nextStatus = (status !== null && status !== void 0 ? status : match.status);
        if (nextStatus === constants_1.MATCH_STATUS.FINISHED) {
            const winnerId = winner !== null && winner !== void 0 ? winner : previousWinner;
            if (!winnerId) {
                return void res.status(400).json({ message: "Falta indicar el equipo ganador" });
            }
            if (!match.teams.some((t) => t.teamId.toString() === winnerId.toString())) {
                return void res.status(400).json({
                    message: "El ganador debe ser uno de los equipos del partido"
                });
            }
            match.winner = new mongoose_1.default.Types.ObjectId(winnerId);
            const loser = match.teams.find((t) => t.teamId.toString() !== winnerId.toString());
            match.losingTeam = loser ? loser.teamId : undefined;
        }
        const winnerChanged = previousWinner !== undefined && ((_b = match.winner) === null || _b === void 0 ? void 0 : _b.toString()) !== previousWinner;
        const unfinished = previousStatus === constants_1.MATCH_STATUS.FINISHED && nextStatus !== constants_1.MATCH_STATUS.FINISHED;
        let revertedMatches = 0;
        let reopenedTournament = false;
        if (match.tournament && (winnerChanged || unfinished)) {
            revertedMatches = yield rollbackDownstream(previous);
            const tournament = yield Tournament_1.default.findById(match.tournament);
            if (tournament && (tournament.pointsAwarded || tournament.status === "completed")) {
                yield (0, tournament_controller_1.revertTournamentPoints)(tournament);
                tournament.playerStats = [];
                tournament.status = "in_progress";
                yield tournament.save();
                reopenedTournament = true;
            }
        }
        if (unfinished) {
            match.winner = undefined;
            match.losingTeam = undefined;
        }
        match.status = nextStatus;
        yield match.save();
        if (match.status === constants_1.MATCH_STATUS.FINISHED && match.tournament) {
            yield propagateResult(match);
        }
        const notes = [];
        if (revertedMatches > 0) {
            notes.push(`se revirtieron ${revertedMatches} partido(s) posteriores del cuadro`);
        }
        if (reopenedTournament) {
            notes.push("el torneo se reabrió y se descontaron los puntos otorgados");
        }
        res.status(200).json({
            message: notes.length
                ? `Partido actualizado: ${notes.join(" y ")}.`
                : "Partido actualizado",
            match
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al actualizar el partido", error: error.message });
    }
});
exports.updateMatch = updateMatch;
const deleteMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            return void res.status(400).json({ message: "ID de partido inválido" });
        }
        const match = yield Match_1.default.findById(id);
        if (!match) {
            return void res.status(404).json({ message: "Partido no encontrado" });
        }
        if (match.tournament) {
            yield Tournament_1.default.updateOne({ _id: match.tournament }, { $pull: { matches: match._id } });
        }
        yield match.deleteOne();
        res.status(200).json({ message: "Partido eliminado" });
    }
    catch (error) {
        res.status(500).json({ message: "Error al eliminar el partido", error: error.message });
    }
});
exports.deleteMatch = deleteMatch;
const getAdminStats = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const [totalUsers, newUsers, totalTournaments, upcoming, inProgress, completed, totalMatches, liveMatches, topPlayers, recentTournaments] = yield Promise.all([
            User_1.default.countDocuments(),
            User_1.default.countDocuments({ createdAt: { $gte: since } }),
            Tournament_1.default.countDocuments(),
            Tournament_1.default.countDocuments({ status: "upcoming" }),
            Tournament_1.default.countDocuments({ status: "in_progress" }),
            Tournament_1.default.countDocuments({ status: "completed" }),
            Match_1.default.countDocuments(),
            Match_1.default.countDocuments({ status: constants_1.MATCH_STATUS.IN_PROGRESS }),
            User_1.default.find()
                .select("username totalPoints")
                .sort({ totalPoints: -1 })
                .limit(5),
            Tournament_1.default.find()
                .select("name status startDate createdAt teams individualSignups logo")
                .sort({ createdAt: -1 })
                .limit(5)
        ]);
        res.status(200).json({
            users: { total: totalUsers, newLast30Days: newUsers },
            tournaments: {
                total: totalTournaments,
                upcoming,
                inProgress,
                completed
            },
            matches: { total: totalMatches, inProgress: liveMatches },
            topPlayers,
            recentTournaments,
            config: {
                teamsPerTournament: constants_1.TOURNAMENT_TEAMS_COUNT,
                teamSize: constants_1.FORMAT_TEAM_SIZE
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener las métricas", error: error.message });
    }
});
exports.getAdminStats = getAdminStats;
