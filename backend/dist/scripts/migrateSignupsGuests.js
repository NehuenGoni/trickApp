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
const Tournament_1 = __importDefault(require("../models/Tournament"));
dotenv_1.default.config();
/**
 * Backfill para torneos `upcoming` creados antes de que `individualSignups`
 * soportara invitados sueltos: agrega `signupId` (antes inexistente) e `isGuest`
 * (antes ausente, todos eran usuarios registrados) a cada inscripto, y `isDrawn`
 * a cada equipo. `auto: true` en el schema solo genera el id al crear un
 * subdocumento nuevo vía Mongoose, no rellena documentos ya persistidos.
 */
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            console.error("MONGO_URI no está definida en .env");
            process.exit(1);
        }
        yield mongoose_1.default.connect(mongoURI);
        console.log("Conectado a MongoDB");
        const tournaments = yield Tournament_1.default.find({}).lean();
        let tournamentsUpdated = 0;
        for (const t of tournaments) {
            const signups = ((_a = t.individualSignups) !== null && _a !== void 0 ? _a : []);
            const teams = ((_b = t.teams) !== null && _b !== void 0 ? _b : []);
            let signupsChanged = false;
            const newSignups = signups.map((s) => {
                var _a, _b;
                if (s.signupId && s.isGuest !== undefined)
                    return s;
                signupsChanged = true;
                return Object.assign(Object.assign({}, s), { signupId: (_a = s.signupId) !== null && _a !== void 0 ? _a : new mongoose_1.default.Types.ObjectId(), isGuest: (_b = s.isGuest) !== null && _b !== void 0 ? _b : false });
            });
            let teamsChanged = false;
            const newTeams = teams.map((team) => {
                if (team.isDrawn !== undefined)
                    return team;
                teamsChanged = true;
                return Object.assign(Object.assign({}, team), { isDrawn: false });
            });
            if (!signupsChanged && !teamsChanged)
                continue;
            const update = {};
            if (signupsChanged)
                update.individualSignups = newSignups;
            if (teamsChanged)
                update.teams = newTeams;
            yield Tournament_1.default.updateOne({ _id: t._id }, { $set: update });
            tournamentsUpdated++;
        }
        console.log(`Tournaments actualizados: ${tournamentsUpdated}`);
        yield mongoose_1.default.disconnect();
        console.log("Migración completada");
    });
}
run().catch((err) => {
    console.error("Error en migración:", err);
    process.exit(1);
});
