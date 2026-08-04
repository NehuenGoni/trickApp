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
dotenv_1.default.config();
/**
 * Audita, colección por colección, qué documentos de la base indicada por
 * MONGO_URI_PROD todavía no tienen los campos que el esquema actual agregó
 * respecto a lo que corre en producción. Es de solo lectura: no escribe nada.
 *
 * Usa el driver crudo (mongoose.connection.db) en vez de los modelos: un
 * `Model.find()` normal aplica los `default` del schema al hidratar y
 * escondería justamente lo que queremos ver (campos ausentes en el documento
 * persistido).
 *
 * Uso: npx ts-node src/scripts/auditProdSchema.ts
 */
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
        console.log(`Conectado a MongoDB — base: ${mongoose_1.default.connection.name}\n`);
        // --- users ---
        const users = db.collection("users");
        const usersTotal = yield users.countDocuments({});
        const usersSinRole = yield users.countDocuments({ role: { $exists: false } });
        const usersSinTotalPoints = yield users.countDocuments({ totalPoints: { $exists: false } });
        const usersSinPointsAdjustments = yield users.countDocuments({ pointsAdjustments: { $exists: false } });
        const usersSinCreatedAt = yield users.countDocuments({ createdAt: { $exists: false } });
        console.log("users");
        console.log(`  total: ${usersTotal}`);
        console.log(`  sin role: ${usersSinRole}`);
        console.log(`  sin totalPoints: ${usersSinTotalPoints}`);
        console.log(`  sin pointsAdjustments: ${usersSinPointsAdjustments}`);
        console.log(`  sin createdAt/updatedAt: ${usersSinCreatedAt}`);
        // --- tournaments ---
        const tournaments = db.collection("tournaments");
        const tournamentsTotal = yield tournaments.countDocuments({});
        const tSinType = yield tournaments.countDocuments({ type: { $exists: false } });
        const tSinFormat = yield tournaments.countDocuments({ format: { $exists: false } });
        const tSinTeamFormationMode = yield tournaments.countDocuments({ teamFormationMode: { $exists: false } });
        const tSinIndividualSignups = yield tournaments.countDocuments({ individualSignups: { $exists: false } });
        const tSinPlayerStats = yield tournaments.countDocuments({ playerStats: { $exists: false } });
        const tSinPointsAwarded = yield tournaments.countDocuments({ pointsAwarded: { $exists: false } });
        const tTeamsSinIsDrawn = yield tournaments.countDocuments({ "teams.isDrawn": { $exists: false }, "teams.0": { $exists: true } });
        const tSignupsSinSignupId = yield tournaments.countDocuments({
            "individualSignups.0": { $exists: true },
            "individualSignups.signupId": { $exists: false }
        });
        console.log("\ntournaments");
        console.log(`  total: ${tournamentsTotal}`);
        console.log(`  sin type: ${tSinType}`);
        console.log(`  sin format: ${tSinFormat}`);
        console.log(`  sin teamFormationMode: ${tSinTeamFormationMode}`);
        console.log(`  sin individualSignups: ${tSinIndividualSignups}`);
        console.log(`  sin playerStats: ${tSinPlayerStats}`);
        console.log(`  sin pointsAwarded: ${tSinPointsAwarded}`);
        console.log(`  con teams pero algún team sin isDrawn: ${tTeamsSinIsDrawn}`);
        console.log(`  con individualSignups pero algún signup sin signupId: ${tSignupsSinSignupId}`);
        // --- matches ---
        const matches = db.collection("matches");
        const matchesTotal = yield matches.countDocuments({});
        const mSinBracketSlot = yield matches.countDocuments({ bracketSlot: { $exists: false } });
        const phaseDistinct = yield matches.distinct("phase");
        const legacyPhaseCount = yield matches.countDocuments({
            bracketSlot: { $exists: false },
            phase: { $in: ["group", "quarter", "semi", "semi-finals", "final"] }
        });
        console.log("\nmatches");
        console.log(`  total: ${matchesTotal}`);
        console.log(`  sin bracketSlot: ${mSinBracketSlot}`);
        console.log(`  valores distintos de phase: ${JSON.stringify(phaseDistinct)}`);
        console.log(`  sin bracketSlot y con phase legacy a mapear: ${legacyPhaseCount}`);
        // --- leagues ---
        const leagues = db.collection("leagues");
        const leaguesTotal = yield leagues.countDocuments({});
        console.log("\nleagues");
        console.log(`  total: ${leaguesTotal}`);
        // --- índices existentes en matches ---
        const matchIndexes = yield matches.indexes();
        const matchIndexNames = matchIndexes.map((i) => i.name);
        console.log("\níndices existentes en matches:", matchIndexNames);
        const expectedIndexes = ["status_1", "tournament_1_bracketSlot_1_status_1"];
        const missingIndexes = expectedIndexes.filter((n) => !matchIndexNames.includes(n));
        console.log("índices faltantes en matches:", missingIndexes.length ? missingIndexes : "ninguno");
        yield mongoose_1.default.disconnect();
        console.log("\nAuditoría completada");
    });
}
run().catch((err) => {
    console.error("Error en auditoría:", err);
    process.exit(1);
});
