import dotenv from "dotenv";
import mongoose from "mongoose";
import type { Db } from "mongodb";
import { periodKeyOf } from "../config/plans";

dotenv.config();

/**
 * Backfill idempotente para introducir el sistema de suscripción: le da a
 * cada usuario existente un `billing` grandfathered en plan `free`, sembrado
 * con el conteo REAL de torneos que ya creó (para que nadie reciba un torneo
 * de prueba gratis retroactivo por haber usado la app antes de que existiera
 * el límite). También asegura `League.organizers` en las ligas que se hayan
 * creado antes de esa feature.
 *
 * Mismo contrato que `migrateProdToLatest.ts`:
 *  - driver crudo (mongoose.connection.db), no los modelos de Mongoose;
 *  - solo toca documentos donde el campo está ausente ($exists:false);
 *  - nunca hace $unset ni reemplaza un documento entero;
 *  - dry-run por default; escribir requiere --apply;
 *  - exige --confirm-db=<nombre> para no correr contra la base equivocada.
 *
 * Uso:
 *   npx ts-node src/scripts/migrateBilling.ts --confirm-db=testTrickApp --apply   (ensayo)
 *   npx ts-node src/scripts/migrateBilling.ts --confirm-db=trickApp                (dry-run en prod)
 *   npx ts-node src/scripts/migrateBilling.ts --confirm-db=trickApp --apply        (aplica en prod)
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmDbArg = args.find((a) => a.startsWith("--confirm-db="));
  const confirmDb = confirmDbArg?.split("=")[1];
  return { apply, confirmDb };
}

/**
 * Por usuario: cuenta cuántos torneos ya creó (`tournaments.createdBy`) y
 * siembra `tournamentsTotal` con ese número. No puede ser un `updateMany`
 * porque el valor depende de cada documento — mismo patrón que
 * `backfillUserTimestamps` en `migrateProdToLatest.ts`.
 */
async function backfillUserBilling(db: Db, apply: boolean) {
  const users = db.collection("users");
  const tournaments = db.collection("tournaments");
  const cursor = users.find({ billing: { $exists: false } }, { projection: { _id: 1 } });

  let candidates = 0;
  let modified = 0;
  const currentPeriodKey = periodKeyOf(new Date());

  for await (const doc of cursor) {
    candidates++;
    const tournamentsTotal = await tournaments.countDocuments({ createdBy: doc._id });
    if (candidates <= 20) {
      // Muestra los primeros N en dry-run para poder auditar antes de aplicar.
      console.log(`    [preview] user ${doc._id} → tournamentsTotal=${tournamentsTotal}`);
    }
    if (!apply) continue;

    const result = await users.updateOne(
      { _id: doc._id, billing: { $exists: false } },
      {
        $set: {
          billing: {
            plan: "free",
            status: "none",
            currentPeriodEnd: null,
            usage: {
              periodKey: currentPeriodKey,
              tournamentsCreated: 0,
              tournamentsTotal
            },
            grandfathered: true
          }
        }
      }
    );
    if (result.modifiedCount) modified++;
  }

  if (!apply) {
    console.log(`  [dry-run] backfill users.billing (grandfathered, free) → afectaría ${candidates} usuario(s)`);
  } else {
    console.log(`  backfill users.billing (grandfathered, free) → modificados ${modified} de ${candidates} candidatos`);
  }
}

async function migrateLeagueOrganizers(db: Db, apply: boolean) {
  const leagues = db.collection("leagues");
  const filter = { organizers: { $exists: false } };
  if (!apply) {
    const matched = await leagues.countDocuments(filter);
    console.log(`  [dry-run] leagues.organizers ausente → [] → coincidirían ${matched} documento(s)`);
    return;
  }
  const result = await leagues.updateMany(filter, { $set: { organizers: [] } });
  console.log(`  leagues.organizers ausente → [] → modificados ${result.modifiedCount} de ${result.matchedCount} coincidentes`);
}

async function ensureBillingIndexes(db: Db, apply: boolean) {
  if (!apply) {
    console.log("  [dry-run] índices de subscriptions y payments → se crearían con --apply");
    return;
  }
  await db.collection("subscriptions").createIndex({ userId: 1, status: 1 });
  await db.collection("subscriptions").createIndex(
    { paymentProvider: 1, externalId: 1 },
    { unique: true, partialFilterExpression: { externalId: { $exists: true } } }
  );
  await db.collection("payments").createIndex(
    { paymentProvider: 1, externalId: 1 },
    { unique: true, partialFilterExpression: { externalId: { $exists: true } } }
  );
  await db.collection("payments").createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
  await db.collection("tournaments").createIndex({ createdBy: 1 }); // usado por el propio backfill y por getUserDetail
  console.log("  índices de subscriptions y payments → asegurados (createIndex es idempotente)");
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

  console.log("\nusers.billing");
  await backfillUserBilling(db, apply);

  console.log("\nleagues.organizers");
  await migrateLeagueOrganizers(db, apply);

  console.log("\níndices");
  await ensureBillingIndexes(db, apply);

  await mongoose.disconnect();
  console.log(apply ? "\nMigración aplicada." : "\nDry-run completado. Nada fue modificado.");
  console.log(
    "\nRecordatorio manual (no lo hace este script): activar plan 'pro' al superadmin y a la cuenta " +
      "del bar piloto vía POST /admin/users/:id/subscription, para que puedan operar sin límites desde el día uno."
  );
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
