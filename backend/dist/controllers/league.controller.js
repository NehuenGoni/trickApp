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
exports.getLeagueStandings = exports.detachTournament = exports.attachTournament = exports.deleteLeague = exports.updateLeague = exports.getLeagueById = exports.getLeagues = exports.createLeague = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const League_1 = __importDefault(require("../models/League"));
const LeagueLogo_1 = __importDefault(require("../models/LeagueLogo"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const leaguePermissions_1 = require("../utils/leaguePermissions");
const leagueStandings_1 = require("../utils/leagueStandings");
const withTransaction_1 = require("../utils/withTransaction");
// Campos del torneo que necesita el frontend para listarlo dentro de una liga,
// sin `playerStats` (eso ya lo resume `computeLeagueStandings`).
const TOURNAMENT_SUMMARY_FIELDS = "name status type startDate logo";
const createLeague = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!(0, leaguePermissions_1.canManageLeagues)(req.authUser)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        const { name, description, startDate, endDate, isActive } = req.body;
        if (!(name === null || name === void 0 ? void 0 : name.trim())) {
            res.status(400).json({ message: "El nombre es obligatorio" });
            return;
        }
        const parsedStart = new Date(startDate);
        if (Number.isNaN(parsedStart.getTime())) {
            res.status(400).json({ message: "Fecha de inicio inválida" });
            return;
        }
        let parsedEnd;
        if (endDate !== undefined && endDate !== null && endDate !== "") {
            parsedEnd = new Date(endDate);
            if (Number.isNaN(parsedEnd.getTime())) {
                res.status(400).json({ message: "Fecha de fin inválida" });
                return;
            }
        }
        const league = new League_1.default({
            name: name.trim(),
            description,
            startDate: parsedStart,
            endDate: parsedEnd,
            isActive: isActive !== null && isActive !== void 0 ? isActive : true,
            createdBy: req.authUser.id
        });
        yield league.save();
        res.status(201).json(league);
    }
    catch (error) {
        res.status(400).json({ message: "Error al crear la liga", error: error.message });
    }
});
exports.createLeague = createLeague;
const getLeagues = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const includeInactive = req.query.includeInactive === "1" || req.query.includeInactive === "true";
        const filter = includeInactive ? {} : { isActive: true };
        const leagues = yield League_1.default.find(filter).sort({ startDate: -1 }).lean();
        // Contadores por liga con una sola query, agrupada en JS: el volumen de
        // torneos-con-liga no justifica una aggregation pipeline.
        const tournamentsByLeague = yield Tournament_1.default.find({ league: { $ne: null } })
            .select("league status")
            .lean();
        const counts = new Map();
        for (const t of tournamentsByLeague) {
            if (!t.league)
                continue;
            const key = t.league.toString();
            const entry = (_a = counts.get(key)) !== null && _a !== void 0 ? _a : { tournamentCount: 0, completedCount: 0 };
            entry.tournamentCount += 1;
            if (t.status === "completed")
                entry.completedCount += 1;
            counts.set(key, entry);
        }
        const result = leagues.map((league) => {
            var _a;
            return (Object.assign(Object.assign({}, league), ((_a = counts.get(league._id.toString())) !== null && _a !== void 0 ? _a : { tournamentCount: 0, completedCount: 0 })));
        });
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener las ligas", error: error.message });
    }
});
exports.getLeagues = getLeagues;
const getLeagueById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "ID de liga inválido" });
            return;
        }
        const league = yield League_1.default.findById(id);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        const [tournaments, standingsResult] = yield Promise.all([
            Tournament_1.default.find({ league: id }).select(TOURNAMENT_SUMMARY_FIELDS).sort({ startDate: -1 }),
            (0, leagueStandings_1.computeLeagueStandings)(id)
        ]);
        res.status(200).json({
            league,
            tournaments,
            standings: standingsResult.standings,
            tournamentsCounted: standingsResult.tournamentsCounted,
            guestCount: standingsResult.guestCount
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener la liga", error: error.message });
    }
});
exports.getLeagueById = getLeagueById;
const updateLeague = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "ID de liga inválido" });
            return;
        }
        const league = yield League_1.default.findById(id);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        if (!(0, leaguePermissions_1.canManageLeague)(req.authUser, league)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        const { name, description, startDate, endDate, isActive } = req.body;
        if (name !== undefined) {
            if (!name.trim()) {
                res.status(400).json({ message: "El nombre no puede estar vacío" });
                return;
            }
            league.name = name.trim();
        }
        if (description !== undefined)
            league.description = description;
        if (startDate !== undefined) {
            const parsed = new Date(startDate);
            if (Number.isNaN(parsed.getTime())) {
                res.status(400).json({ message: "Fecha de inicio inválida" });
                return;
            }
            league.startDate = parsed;
        }
        if (endDate !== undefined) {
            if (endDate === null || endDate === "") {
                league.endDate = undefined;
            }
            else {
                const parsed = new Date(endDate);
                if (Number.isNaN(parsed.getTime())) {
                    res.status(400).json({ message: "Fecha de fin inválida" });
                    return;
                }
                league.endDate = parsed;
            }
        }
        if (isActive !== undefined)
            league.isActive = isActive;
        yield league.save();
        res.status(200).json(league);
    }
    catch (error) {
        res.status(400).json({ message: "Error al actualizar la liga", error: error.message });
    }
});
exports.updateLeague = updateLeague;
const deleteLeague = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "ID de liga inválido" });
            return;
        }
        const league = yield League_1.default.findById(id);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        if (!(0, leaguePermissions_1.canManageLeague)(req.authUser, league)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        const unlinked = yield (0, withTransaction_1.withTransaction)((session) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const result = yield Tournament_1.default.updateMany({ league: id }, { $unset: { league: "" } }, { session });
            // El logo vive en su propia colección (igual que el de torneos), así
            // que no se va solo con el documento de la liga.
            yield LeagueLogo_1.default.deleteOne({ leagueId: id }, { session });
            yield league.deleteOne({ session });
            return (_a = result.modifiedCount) !== null && _a !== void 0 ? _a : 0;
        }));
        res.status(200).json({
            message: `Liga eliminada. ${unlinked} torneo(s) quedaron sin liga (no se borró ningún torneo).`
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error al eliminar la liga", error: error.message });
    }
});
exports.deleteLeague = deleteLeague;
const attachTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id, tournamentId } = req.params;
        if (!mongoose_1.default.isValidObjectId(id) || !mongoose_1.default.isValidObjectId(tournamentId)) {
            res.status(400).json({ message: "ID inválido" });
            return;
        }
        const league = yield League_1.default.findById(id);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        if (!(0, leaguePermissions_1.canManageLeague)(req.authUser, league)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        const tournament = yield Tournament_1.default.findById(tournamentId);
        if (!tournament) {
            res.status(404).json({ message: "Torneo no encontrado" });
            return;
        }
        if (tournament.league && tournament.league.toString() !== id) {
            const currentLeague = yield League_1.default.findById(tournament.league).select("name");
            res.status(409).json({
                message: `El torneo ya pertenece a la liga "${(_a = currentLeague === null || currentLeague === void 0 ? void 0 : currentLeague.name) !== null && _a !== void 0 ? _a : "desconocida"}"`
            });
            return;
        }
        if (((_b = tournament.league) === null || _b === void 0 ? void 0 : _b.toString()) === id) {
            res.status(200).json({ message: "El torneo ya está en esta liga", tournament });
            return;
        }
        tournament.league = league._id;
        yield tournament.save();
        res.status(200).json({ message: "Torneo agregado a la liga", tournament });
    }
    catch (error) {
        res.status(400).json({ message: "Error al agregar el torneo a la liga", error: error.message });
    }
});
exports.attachTournament = attachTournament;
const detachTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, tournamentId } = req.params;
        if (!mongoose_1.default.isValidObjectId(id) || !mongoose_1.default.isValidObjectId(tournamentId)) {
            res.status(400).json({ message: "ID inválido" });
            return;
        }
        const league = yield League_1.default.findById(id);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        if (!(0, leaguePermissions_1.canManageLeague)(req.authUser, league)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        const result = yield Tournament_1.default.updateOne({ _id: tournamentId, league: id }, { $unset: { league: "" } });
        if (result.matchedCount === 0) {
            res.status(404).json({ message: "El torneo no pertenece a esta liga" });
            return;
        }
        res.status(200).json({ message: "Torneo quitado de la liga" });
    }
    catch (error) {
        res.status(400).json({ message: "Error al quitar el torneo de la liga", error: error.message });
    }
});
exports.detachTournament = detachTournament;
const getLeagueStandings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "ID de liga inválido" });
            return;
        }
        const league = yield League_1.default.findById(id).select("_id");
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        const result = yield (0, leagueStandings_1.computeLeagueStandings)(id);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: "Error al obtener la tabla de posiciones", error: error.message });
    }
});
exports.getLeagueStandings = getLeagueStandings;
