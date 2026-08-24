import dotenv from "dotenv";
import mongoose from "mongoose";
import type { Db } from "mongodb";
import { ROLES, TOURNAMENT_TYPES, TOURNAMENT_FORMATS, TEAM_FORMATION_MODES, GUEST_DRAW_MODES } from "../config/constants";

dotenv.config();

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
const LEGACY_PHASE_MAP: Record<string, string> = {
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
  const confirmDb = confirmDbArg?.split("=")[1];
  return { apply, confirmDb };
}

/** updateMany simple: cuenta en dry-run, aplica en modo real. */
async function runUpdate(
  db: Db,
  collectionName: string,
  description: string,
  filter: Record<string, unknown>,
  update: Record<string, unknown>,
  apply: boolean,
  options?: Record<string, unknown>
) {
  const collection = db.collection(collectionName);
  if (!apply) {
    const matched = await collection.countDocuments(filter);
    console.log(`  [dry-run] ${description} → coincidirían ${matched} documento(s)`);
    return;
  }
  const result = await collection.updateMany(filter, update, options as any);
  console.log(`  ${description} → modificados ${result.modifiedCount} de ${result.matchedCount} coincidentes`);
}

/**
 * Backfill de createdAt/updatedAt en users derivándolos del timestamp
 * embebido en el _id (Mongoose ObjectId trae la fecha de creación real).
 * No se puede hacer con un updateMany porque el valor depende de cada
 * documento.
 */
async function backfillUserTimestamps(db: Db, apply: boolean) {
  const collection = db.collection("users");
  const filter = { createdAt: { $exists: false } };
  const cursor = collection.find(filter, { projection: { _id: 1 } });
  let candidates = 0;
  let modified = 0;
  for await (const doc of cursor) {
    candidates++;
    if (!apply) continue;
    const ts = (doc._id as mongoose.Types.ObjectId).getTimestamp();
    const result = await collection.updateOne({ _id: doc._id }, { $set: { createdAt: ts, updatedAt: ts } });
    if (result.modifiedCount) modified++;
  }
  if (!apply) {
    console.log(`  [dry-run] backfill createdAt/updatedAt desde _id → afectaría ${candidates} documento(s)`);
  } else {
    console.log(`  backfill createdAt/updatedAt desde _id → modificados ${modified} de ${candidates} candidatos`);
  }
}

/**
 * Backfill de subdocumentos de tournaments que necesitan un valor generado
 * por elemento (signupId único por inscripto) en vez de un literal constante,
 * así que no alcanza con un updateMany + arrayFilters (asignaría el mismo
 * valor a todos los elementos que matcheen dentro del mismo documento).
 * Mismo patrón que backend/src/scripts/migrateSignupsGuests.ts.
 */
async function backfillTournamentSubdocs(db: Db, apply: boolean) {
  const collection = db.collection("tournaments");
  const cursor = collection.find({});
  let tournamentsTouched = 0;
  let signupsFilled = 0;
  let teamsFilled = 0;

  for await (const t of cursor) {
    const signups = (t.individualSignups ?? []) as Array<{
      signupId?: mongoose.Types.ObjectId;
      isGuest?: boolean;
      [key: string]: unknown;
    }>;
    const teams = (t.teams ?? []) as Array<{ isDrawn?: boolean; [key: string]: unknown }>;

    let signupsChanged = false;
    const newSignups = signups.map((s) => {
      if (s.signupId !== undefined && s.isGuest !== undefined) return s;
      signupsChanged = true;
      signupsFilled++;
      return {
        ...s,
        signupId: s.signupId ?? new mongoose.Types.ObjectId(),
        isGuest: s.isGuest ?? false
      };
    });

    let teamsChanged = false;
    const newTeams = teams.map((team) => {
      if (team.isDrawn !== undefined) return team;
      teamsChanged = true;
      teamsFilled++;
      return { ...team, isDrawn: false };
    });

    if (!signupsChanged && !teamsChanged) continue;
    tournamentsTouched++;
    if (!apply) continue;

    const update: Record<string, unknown> = {};
    if (signupsChanged) update.individualSignups = newSignups;
    if (teamsChanged) update.teams = newTeams;
    await collection.updateOne({ _id: t._id }, { $set: update });
  }

  if (!apply) {
    console.log(
      `  [dry-run] backfill individualSignups.signupId/isGuest y teams.isDrawn → afectaría ${tournamentsTouched} torneo(s)`
    );
  } else {
    console.log(
      `  backfill individualSignups.signupId/isGuest y teams.isDrawn → modificados ${tournamentsTouched} torneo(s) (${signupsFilled} signup(s), ${teamsFilled} team(s))`
    );
  }
}

async function migrateUsers(db: Db, apply: boolean) {
  console.log("\nusers");
  await runUpdate(db, "users", "role ausente → 'user'", { role: { $exists: false } }, { $set: { role: ROLES.USER } }, apply);
  await runUpdate(
    db,
    "users",
    "totalPoints ausente → 0",
    { totalPoints: { $exists: false } },
    { $set: { totalPoints: 0 } },
    apply
  );
  await runUpdate(
    db,
    "users",
    "pointsAdjustments ausente → []",
    { pointsAdjustments: { $exists: false } },
    { $set: { pointsAdjustments: [] } },
    apply
  );
  await backfillUserTimestamps(db, apply);

  if (!apply) {
    console.log("  [dry-run] índice totalPoints_-1 → se crearía con --apply");
  } else {
    await db.collection("users").createIndex({ totalPoints: -1 }, { background: true });
    console.log("  índice totalPoints_-1 → asegurado (createIndex es idempotente)");
  }
}

async function migrateTournaments(db: Db, apply: boolean) {
  console.log("\ntournaments");
  await runUpdate(
    db,
    "tournaments",
    `type ausente → '${TOURNAMENT_TYPES.MASTER_1000}'`,
    { type: { $exists: false } },
    { $set: { type: TOURNAMENT_TYPES.MASTER_1000 } },
    apply
  );
  await runUpdate(
    db,
    "tournaments",
    `format ausente → '${TOURNAMENT_FORMATS.DUOS}'`,
    { format: { $exists: false } },
    { $set: { format: TOURNAMENT_FORMATS.DUOS } },
    apply
  );
  await runUpdate(
    db,
    "tournaments",
    `teamFormationMode ausente → '${TEAM_FORMATION_MODES.USER_FORMED}'`,
    { teamFormationMode: { $exists: false } },
    { $set: { teamFormationMode: TEAM_FORMATION_MODES.USER_FORMED } },
    apply
  );
  await runUpdate(
    db,
    "tournaments",
    `guestDrawMode ausente → '${GUEST_DRAW_MODES.GROUPED}'`,
    { guestDrawMode: { $exists: false } },
    { $set: { guestDrawMode: GUEST_DRAW_MODES.GROUPED } },
    apply
  );
  await runUpdate(
    db,
    "tournaments",
    "individualSignups ausente (campo entero) → []",
    { individualSignups: { $exists: false } },
    { $set: { individualSignups: [] } },
    apply
  );
  await runUpdate(
    db,
    "tournaments",
    "playerStats ausente → []",
    { playerStats: { $exists: false } },
    { $set: { playerStats: [] } },
    apply
  );
  await runUpdate(
    db,
    "tournaments",
    "pointsAwarded ausente → false",
    { pointsAwarded: { $exists: false } },
    { $set: { pointsAwarded: false } },
    apply
  );
  await backfillTournamentSubdocs(db, apply);

  // No hay backfill de datos para `league`: la colección `leagues` está vacía
  // en producción al momento de esta migración (la feature nunca tuvo UI), así
  // que ningún torneo puede referenciar una liga todavía. Solo hace falta el
  // índice nuevo, que usa `computeLeagueStandings` (ver utils/leagueStandings.ts).
  if (!apply) {
    console.log("  [dry-run] índices league_1_status_1 y playerStats.playerId_1_status_1 → se crearían con --apply");
  } else {
    const tournaments = db.collection("tournaments");
    await tournaments.createIndex({ league: 1, status: 1 });
    // Trayectoria en torneos de un jugador (utils/userStats).
    await tournaments.createIndex({ "playerStats.playerId": 1, status: 1 }, { background: true });
    console.log("  índices league_1_status_1 y playerStats.playerId_1_status_1 → asegurados (createIndex es idempotente)");
  }
}

async function migrateMatches(db: Db, apply: boolean) {
  console.log("\nmatches");
  for (const [oldPhase, newPhase] of Object.entries(LEGACY_PHASE_MAP)) {
    await runUpdate(
      db,
      "matches",
      `phase legacy '${oldPhase}' → '${newPhase}' (solo sin bracketSlot)`,
      { bracketSlot: { $exists: false }, phase: oldPhase },
      { $set: { phase: newPhase } },
      apply
    );
  }

  if (!apply) {
    console.log(
      "  [dry-run] índices status_1, tournament_1_bracketSlot_1_status_1 y teams.players.playerId_1_createdAt_-1 → se crearían con --apply"
    );
    return;
  }
  const matches = db.collection("matches");
  await matches.createIndex({ status: 1 });
  await matches.createIndex({ tournament: 1, bracketSlot: 1, status: 1 });
  // Historial y estadísticas de un jugador (utils/userStats). Multikey sobre
  // una colección potencialmente grande: en background para no bloquear.
  await matches.createIndex({ "teams.players.playerId": 1, createdAt: -1 }, { background: true });
  console.log(
    "  índices status_1, tournament_1_bracketSlot_1_status_1 y teams.players.playerId_1_createdAt_-1 → asegurados (createIndex es idempotente)"
  );
}

async function run() {
  const { apply, confirmDb } = parseArgs();
  if (!confirmDb) {
    console.error(
      "Falta --confirm-db=<nombre-de-base>. Es obligatorio (incluso en dry-run) para evitar migrar la base equivocada."
    );
    process.exit(1);
  }

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

  if (mongoose.connection.name !== confirmDb) {
    console.error(
      `La base conectada es "${mongoose.connection.name}", pero pediste --confirm-db=${confirmDb}. Abortando sin tocar nada.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Conectado a MongoDB — base: ${mongoose.connection.name}`);
  console.log(apply ? "MODO: APLICANDO CAMBIOS (--apply)" : "MODO: DRY-RUN (no se escribe nada; pasá --apply para aplicar)");

  await migrateUsers(db, apply);
  await migrateTournaments(db, apply);
  await migrateMatches(db, apply);

  await mongoose.disconnect();
  console.log(apply ? "\nMigración aplicada." : "\nDry-run completado. Nada fue modificado.");
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
