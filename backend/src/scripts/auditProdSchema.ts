import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

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
async function run() {
  const mongoURI = process.env.MONGO_URI_PROD;
  if (!mongoURI) {
    console.error("MONGO_URI_PROD no está definida en .env");
    process.exit(1);
  }

  await mongoose.connect(mongoURI);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("No se pudo obtener el handle de la base de datos");
    process.exit(1);
  }
  console.log(`Conectado a MongoDB — base: ${mongoose.connection.name}\n`);

  // --- users ---
  const users = db.collection("users");
  const usersTotal = await users.countDocuments({});
  const usersSinRole = await users.countDocuments({ role: { $exists: false } });
  const usersSinTotalPoints = await users.countDocuments({ totalPoints: { $exists: false } });
  const usersSinPointsAdjustments = await users.countDocuments({ pointsAdjustments: { $exists: false } });
  const usersSinCreatedAt = await users.countDocuments({ createdAt: { $exists: false } });

  console.log("users");
  console.log(`  total: ${usersTotal}`);
  console.log(`  sin role: ${usersSinRole}`);
  console.log(`  sin totalPoints: ${usersSinTotalPoints}`);
  console.log(`  sin pointsAdjustments: ${usersSinPointsAdjustments}`);
  console.log(`  sin createdAt/updatedAt: ${usersSinCreatedAt}`);

  // --- tournaments ---
  const tournaments = db.collection("tournaments");
  const tournamentsTotal = await tournaments.countDocuments({});
  const tSinType = await tournaments.countDocuments({ type: { $exists: false } });
  const tSinFormat = await tournaments.countDocuments({ format: { $exists: false } });
  const tSinTeamFormationMode = await tournaments.countDocuments({ teamFormationMode: { $exists: false } });
  const tSinIndividualSignups = await tournaments.countDocuments({ individualSignups: { $exists: false } });
  const tSinPlayerStats = await tournaments.countDocuments({ playerStats: { $exists: false } });
  const tSinPointsAwarded = await tournaments.countDocuments({ pointsAwarded: { $exists: false } });
  const tTeamsSinIsDrawn = await tournaments.countDocuments({ "teams.isDrawn": { $exists: false }, "teams.0": { $exists: true } });
  const tSignupsSinSignupId = await tournaments.countDocuments({
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
  const matchesTotal = await matches.countDocuments({});
  const mSinBracketSlot = await matches.countDocuments({ bracketSlot: { $exists: false } });
  const phaseDistinct = await matches.distinct("phase");
  const legacyPhaseCount = await matches.countDocuments({
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
  const leaguesTotal = await leagues.countDocuments({});
  console.log("\nleagues");
  console.log(`  total: ${leaguesTotal}`);

  // --- índices existentes en matches ---
  const matchIndexes = await matches.indexes();
  const matchIndexNames = matchIndexes.map((i) => i.name);
  console.log("\níndices existentes en matches:", matchIndexNames);
  const expectedIndexes = ["status_1", "tournament_1_bracketSlot_1_status_1"];
  const missingIndexes = expectedIndexes.filter((n) => !matchIndexNames.includes(n));
  console.log("índices faltantes en matches:", missingIndexes.length ? missingIndexes : "ninguno");

  await mongoose.disconnect();
  console.log("\nAuditoría completada");
}

run().catch((err) => {
  console.error("Error en auditoría:", err);
  process.exit(1);
});
