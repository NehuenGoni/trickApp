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
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const Match_1 = __importDefault(require("../models/Match"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const User_1 = __importDefault(require("../models/User"));
const constants_1 = require("../config/constants");
dotenv_1.default.config();
const PHASE_MAP = {
    group: constants_1.MATCH_PHASES.QUARTER_FINALS,
    quarter: constants_1.MATCH_PHASES.QUARTER_FINALS,
    "quarter-finals": constants_1.MATCH_PHASES.QUARTER_FINALS,
    semi: constants_1.MATCH_PHASES.SEMIFINALS_GOLD,
    "semi-finals": constants_1.MATCH_PHASES.SEMIFINALS_GOLD,
    "semifinals-gold": constants_1.MATCH_PHASES.SEMIFINALS_GOLD,
    semifinals: constants_1.MATCH_PHASES.SEMIFINALS,
    final: constants_1.MATCH_PHASES.FINAL_GOLD,
    "final-gold": constants_1.MATCH_PHASES.FINAL_GOLD
};
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            console.error("MONGO_URI no está definida en .env");
            process.exit(1);
        }
        yield mongoose_1.default.connect(mongoURI);
        console.log("Conectado a MongoDB");
        let matchesUpdated = 0;
        const matches = yield Match_1.default.find({}).lean();
        for (const m of matches) {
            const oldPhase = m.phase;
            if (!oldPhase)
                continue;
            const newPhase = PHASE_MAP[oldPhase];
            if (newPhase && newPhase !== oldPhase) {
                yield Match_1.default.updateOne({ _id: m._id }, { $set: { phase: newPhase } });
                matchesUpdated++;
            }
        }
        console.log(`Matches actualizados con phase nuevo: ${matchesUpdated}`);
        const tournamentResult = yield Tournament_1.default.updateMany({
            $or: [
                { type: { $exists: false } },
                { format: { $exists: false } },
                { teamFormationMode: { $exists: false } },
                { individualSignups: { $exists: false } },
                { pointsAwarded: { $exists: false } },
                { playerStats: { $exists: false } }
            ]
        }, {
            $setOnInsert: {},
            $set: {},
        });
        // updateMany con $set vacío no aplica defaults, hago un loop manual
        const tournaments = yield Tournament_1.default.find({}).lean();
        let tournamentsUpdated = 0;
        for (const t of tournaments) {
            const update = {};
            if (!t.type)
                update.type = constants_1.TOURNAMENT_TYPES.MASTER_1000;
            if (!t.format)
                update.format = constants_1.TOURNAMENT_FORMATS.DUOS;
            if (!t.teamFormationMode) {
                update.teamFormationMode = constants_1.TEAM_FORMATION_MODES.USER_FORMED;
            }
            if (!t.individualSignups)
                update.individualSignups = [];
            if (t.pointsAwarded === undefined)
                update.pointsAwarded = false;
            if (!t.playerStats)
                update.playerStats = [];
            if (Object.keys(update).length > 0) {
                yield Tournament_1.default.updateOne({ _id: t._id }, { $set: update });
                tournamentsUpdated++;
            }
        }
        console.log(`Tournaments actualizados: ${tournamentsUpdated}`);
        console.log(`(updateMany pre-pass ack: ${tournamentResult.acknowledged})`);
        const usersResult = yield User_1.default.updateMany({ totalPoints: { $exists: false } }, { $set: { totalPoints: 0 } });
        console.log(`Users actualizados con totalPoints: ${usersResult.modifiedCount}`);
        yield mongoose_1.default.disconnect();
        console.log("Migración completada");
    });
}
run().catch((err) => {
    console.error("Error en migración:", err);
    process.exit(1);
});
