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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const constants_1 = require("../config/constants");
dotenv_1.default.config();
/**
 * Backfill idempotente para poner al día una base que quedó en el esquema
 * de `main` (producción) respecto al esquema actual de `dev`.
 *
 * Reemplaza y unifica a migrateTournaments.ts + migrateSignupsGuests.ts, que
 * quedan en el repo como historia. A diferencia de esos dos, este:
 *  - usa el driver crudo (mongoose.connection.db) en vez de los modelos, para
 *    no depender de hidratación/validators de Mongoose sobre documentos
 *    legacy incompletos;
 *  - solo toca documentos donde el campo está ausente ($exists:false), nunca
 *    pisa un valor ya existente;
 *  - nunca hace $unset ni reemplaza un documento entero;
 *  - es dry-run por default; escribir requiere --apply;
 *  - exige --confirm-db=<nombre> para no correr contra la base equivocada.
 *
 * Uso:
 *   npx ts-node src/scripts/migrateProdToLatest.ts --confirm-db=testTrickApp --apply   (ensayo)
 *   npx ts-node src/scripts/migrateProdToLatest.ts --confirm-db=trickApp                (dry-run en prod)
 *   npx ts-node src/scripts/migrateProdToLatest.ts --confirm-db=trickApp --apply        (aplica en prod)
 */
// Mapeo de valores legacy de `phase` (enum previo a MATCH_PHASES) al enum actual.
// Solo se aplica a partidos SIN bracketSlot: un partido con bracketSlot fue
// creado por el generador nuevo y su phase ya es correcta por construcción.
// OJO: no reusar el PHASE_MAP de migrateTournaments.ts tal cual — ahí `final`
// mapea a `final-gold`, pero en el esquema actual `final` es un valor válido
// en sí mismo (la final de plata, slot FS). Repetir ese mapeo sin la guarda
// de bracketSlot convertiría finales de plata en finales de oro.
const LEGACY_PHASE_MAP = {
    group: "quarter-finals",
    quarter: "quarter-finals",
    semi: "semifinals-gold",
    "semi-finals": "semifinals-gold",
    final: "final-gold"
};
function parseArgs() {
    const args = process.argv.slice(2);
    const apply = args.includes("--apply");
    const confirmDbArg = args.find((a) => a.startsWith("--confirm-db="));
    const confirmDb = confirmDbArg === null || confirmDbArg === void 0 ? void 0 : confirmDbArg.split("=")[1];
    return { apply, confirmDb };
}
/** updateMany simple: cuenta en dry-run, aplica en modo real. */
function runUpdate(db, collectionName, description, filter, update, apply, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = db.collection(collectionName);
        if (!apply) {
            const matched = yield collection.countDocuments(filter);
            console.log(`  [dry-run] ${description} → coincidirían ${matched} documento(s)`);
            return;
        }
        const result = yield collection.updateMany(filter, update, options);
        console.log(`  ${description} → modificados ${result.modifiedCount} de ${result.matchedCount} coincidentes`);
    });
}
/**
 * Backfill de createdAt/updatedAt en users derivándolos del timestamp
 * embebido en el _id (Mongoose ObjectId trae la fecha de creación real).
 * No se puede hacer con un updateMany porque el valor depende de cada
 * documento.
 */
function backfillUserTimestamps(db, apply) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        const collection = db.collection("users");
        const filter = { createdAt: { $exists: false } };
        const cursor = collection.find(filter, { projection: { _id: 1 } });
        let candidates = 0;
        let modified = 0;
        try {
            for (var _d = true, cursor_1 = __asyncValues(cursor), cursor_1_1; cursor_1_1 = yield cursor_1.next(), _a = cursor_1_1.done, !_a; _d = true) {
                _c = cursor_1_1.value;
                _d = false;
                const doc = _c;
                candidates++;
                if (!apply)
                    continue;
                const ts = doc._id.getTimestamp();
                const result = yield collection.updateOne({ _id: doc._id }, { $set: { createdAt: ts, updatedAt: ts } });
                if (result.modifiedCount)
                    modified++;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = cursor_1.return)) yield _b.call(cursor_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (!apply) {
            console.log(`  [dry-run] backfill createdAt/updatedAt desde _id → afectaría ${candidates} documento(s)`);
        }
        else {
            console.log(`  backfill createdAt/updatedAt desde _id → modificados ${modified} de ${candidates} candidatos`);
        }
    });
}
/**
 * Backfill de subdocumentos de tournaments que necesitan un valor generado
 * por elemento (signupId único por inscripto) en vez de un literal constante,
 * así que no alcanza con un updateMany + arrayFilters (asignaría el mismo
 * valor a todos los elementos que matcheen dentro del mismo documento).
 * Mismo patrón que backend/src/scripts/migrateSignupsGuests.ts.
 */
function backfillTournamentSubdocs(db, apply) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_2, _b, _c;
        var _d, _e;
        const collection = db.collection("tournaments");
        const cursor = collection.find({});
        let tournamentsTouched = 0;
        let signupsFilled = 0;
        let teamsFilled = 0;
        try {
            for (var _f = true, cursor_2 = __asyncValues(cursor), cursor_2_1; cursor_2_1 = yield cursor_2.next(), _a = cursor_2_1.done, !_a; _f = true) {
                _c = cursor_2_1.value;
                _f = false;
                const t = _c;
                const signups = ((_d = t.individualSignups) !== null && _d !== void 0 ? _d : []);
                const teams = ((_e = t.teams) !== null && _e !== void 0 ? _e : []);
                let signupsChanged = false;
                const newSignups = signups.map((s) => {
                    var _a, _b;
                    if (s.signupId !== undefined && s.isGuest !== undefined)
                        return s;
                    signupsChanged = true;
                    signupsFilled++;
                    return Object.assign(Object.assign({}, s), { signupId: (_a = s.signupId) !== null && _a !== void 0 ? _a : new mongoose_1.default.Types.ObjectId(), isGuest: (_b = s.isGuest) !== null && _b !== void 0 ? _b : false });
                });
                let teamsChanged = false;
                const newTeams = teams.map((team) => {
                    if (team.isDrawn !== undefined)
                        return team;
                    teamsChanged = true;
                    teamsFilled++;
                    return Object.assign(Object.assign({}, team), { isDrawn: false });
                });
                if (!signupsChanged && !teamsChanged)
                    continue;
                tournamentsTouched++;
                if (!apply)
                    continue;
                const update = {};
                if (signupsChanged)
                    update.individualSignups = newSignups;
                if (teamsChanged)
                    update.teams = newTeams;
                yield collection.updateOne({ _id: t._id }, { $set: update });
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_f && !_a && (_b = cursor_2.return)) yield _b.call(cursor_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (!apply) {
            console.log(`  [dry-run] backfill individualSignups.signupId/isGuest y teams.isDrawn → afectaría ${tournamentsTouched} torneo(s)`);
        }
        else {
            console.log(`  backfill individualSignups.signupId/isGuest y teams.isDrawn → modificados ${tournamentsTouched} torneo(s) (${signupsFilled} signup(s), ${teamsFilled} team(s))`);
        }
    });
}
function migrateUsers(db, apply) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\nusers");
        yield runUpdate(db, "users", "role ausente → 'user'", { role: { $exists: false } }, { $set: { role: constants_1.ROLES.USER } }, apply);
        yield runUpdate(db, "users", "totalPoints ausente → 0", { totalPoints: { $exists: false } }, { $set: { totalPoints: 0 } }, apply);
        yield runUpdate(db, "users", "pointsAdjustments ausente → []", { pointsAdjustments: { $exists: false } }, { $set: { pointsAdjustments: [] } }, apply);
        yield backfillUserTimestamps(db, apply);
    });
}
function migrateTournaments(db, apply) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\ntournaments");
        yield runUpdate(db, "tournaments", `type ausente → '${constants_1.TOURNAMENT_TYPES.MASTER_1000}'`, { type: { $exists: false } }, { $set: { type: constants_1.TOURNAMENT_TYPES.MASTER_1000 } }, apply);
        yield runUpdate(db, "tournaments", `format ausente → '${constants_1.TOURNAMENT_FORMATS.DUOS}'`, { format: { $exists: false } }, { $set: { format: constants_1.TOURNAMENT_FORMATS.DUOS } }, apply);
        yield runUpdate(db, "tournaments", `teamFormationMode ausente → '${constants_1.TEAM_FORMATION_MODES.USER_FORMED}'`, { teamFormationMode: { $exists: false } }, { $set: { teamFormationMode: constants_1.TEAM_FORMATION_MODES.USER_FORMED } }, apply);
        yield runUpdate(db, "tournaments", `guestDrawMode ausente → '${constants_1.GUEST_DRAW_MODES.GROUPED}'`, { guestDrawMode: { $exists: false } }, { $set: { guestDrawMode: constants_1.GUEST_DRAW_MODES.GROUPED } }, apply);
        yield runUpdate(db, "tournaments", "individualSignups ausente (campo entero) → []", { individualSignups: { $exists: false } }, { $set: { individualSignups: [] } }, apply);
        yield runUpdate(db, "tournaments", "playerStats ausente → []", { playerStats: { $exists: false } }, { $set: { playerStats: [] } }, apply);
        yield runUpdate(db, "tournaments", "pointsAwarded ausente → false", { pointsAwarded: { $exists: false } }, { $set: { pointsAwarded: false } }, apply);
        yield backfillTournamentSubdocs(db, apply);
        // No hay backfill de datos para `league`: la colección `leagues` está vacía
        // en producción al momento de esta migración (la feature nunca tuvo UI), así
        // que ningún torneo puede referenciar una liga todavía. Solo hace falta el
        // índice nuevo, que usa `computeLeagueStandings` (ver utils/leagueStandings.ts).
        if (!apply) {
            console.log("  [dry-run] índice league_1_status_1 → se crearía con --apply");
        }
        else {
            yield db.collection("tournaments").createIndex({ league: 1, status: 1 });
            console.log("  índice league_1_status_1 → asegurado (createIndex es idempotente)");
        }
    });
}
function migrateMatches(db, apply) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("\nmatches");
        for (const [oldPhase, newPhase] of Object.entries(LEGACY_PHASE_MAP)) {
            yield runUpdate(db, "matches", `phase legacy '${oldPhase}' → '${newPhase}' (solo sin bracketSlot)`, { bracketSlot: { $exists: false }, phase: oldPhase }, { $set: { phase: newPhase } }, apply);
        }
        if (!apply) {
            console.log("  [dry-run] índices status_1 y tournament_1_bracketSlot_1_status_1 → se crearían con --apply");
            return;
        }
        const matches = db.collection("matches");
        yield matches.createIndex({ status: 1 });
        yield matches.createIndex({ tournament: 1, bracketSlot: 1, status: 1 });
        console.log("  índices status_1 y tournament_1_bracketSlot_1_status_1 → asegurados (createIndex es idempotente)");
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const { apply, confirmDb } = parseArgs();
        if (!confirmDb) {
            console.error("Falta --confirm-db=<nombre-de-base>. Es obligatorio (incluso en dry-run) para evitar migrar la base equivocada.");
            process.exit(1);
        }
        const mongoURI = process.env.MONGO_URI_PROD;
        if (!mongoURI) {
            console.error("MONGO_URI_PROD no está definida en .env");
            process.exit(1);
        }
        yield mongoose_1.default.connect(mongoURI);
        const db = mongoose_1.default.connection.db;
        if (!db) {
            console.error("No se pudo obtener el handle de la base de datos");
            process.exit(1);
        }
        if (mongoose_1.default.connection.name !== confirmDb) {
            console.error(`La base conectada es "${mongoose_1.default.connection.name}", pero pediste --confirm-db=${confirmDb}. Abortando sin tocar nada.`);
            yield mongoose_1.default.disconnect();
            process.exit(1);
        }
        console.log(`Conectado a MongoDB — base: ${mongoose_1.default.connection.name}`);
        console.log(apply ? "MODO: APLICANDO CAMBIOS (--apply)" : "MODO: DRY-RUN (no se escribe nada; pasá --apply para aplicar)");
        yield migrateUsers(db, apply);
        yield migrateTournaments(db, apply);
        yield migrateMatches(db, apply);
        yield mongoose_1.default.disconnect();
        console.log(apply ? "\nMigración aplicada." : "\nDry-run completado. Nada fue modificado.");
    });
}
run().catch((err) => {
    console.error("Error en migración:", err);
    process.exit(1);
});
