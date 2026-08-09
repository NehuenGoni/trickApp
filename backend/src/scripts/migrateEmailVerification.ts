import dotenv from "dotenv";
import mongoose from "mongoose";
import type { Db } from "mongodb";

dotenv.config();

/**
 * Backfill idempotente para introducir la verificación de email: a cada
 * usuario existente (creado antes de que existiera `emailVerified`) lo marca
 * como `emailVerified: true` — grandfathered, igual que `migrateBilling.ts`
 * hizo con el plan `free`. Sin esto, el gate de `requireVerifiedEmail` en
 * `POST /tournaments` y `POST /billing/checkout` dejaría afuera a toda la
 * base de usuarios existente el día que se despliegue.
 *
 * Mismo contrato que `migrateBilling.ts`:
 *  - driver crudo (mongoose.connection.db), no los modelos de Mongoose;
 *  - solo toca documentos donde el campo está ausente ($exists:false);
 *  - nunca hace $unset ni reemplaza un documento entero;
 *  - dry-run por default; escribir requiere --apply;
 *  - exige --confirm-db=<nombre> para no correr contra la base equivocada.
 *
 * Uso:
 *   npx ts-node src/scripts/migrateEmailVerification.ts --confirm-db=testTrickApp --apply   (ensayo)
 *   npx ts-node src/scripts/migrateEmailVerification.ts --confirm-db=trickApp                (dry-run en prod)
 *   npx ts-node src/scripts/migrateEmailVerification.ts --confirm-db=trickApp --apply        (aplica en prod)
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmDbArg = args.find((a) => a.startsWith("--confirm-db="));
  const confirmDb = confirmDbArg?.split("=")[1];
  return { apply, confirmDb };
}

async function backfillEmailVerified(db: Db, apply: boolean) {
  const users = db.collection("users");
  const filter = { emailVerified: { $exists: false } };

  if (!apply) {
    const matched = await users.countDocuments(filter);
    console.log(`  [dry-run] users.emailVerified ausente → true → coincidirían ${matched} documento(s)`);
    return;
  }

  const result = await users.updateMany(filter, { $set: { emailVerified: true } });
  console.log(`  users.emailVerified ausente → true → modificados ${result.modifiedCount} de ${result.matchedCount} coincidentes`);
}

async function ensureIndexes(db: Db, apply: boolean) {
  if (!apply) {
    console.log("  [dry-run] índices de emailVerificationToken y billing.currentPeriodEnd → se crearían con --apply");
    return;
  }
  await db.collection("users").createIndex({ emailVerificationToken: 1 }, { sparse: true });
  await db.collection("users").createIndex({ "billing.currentPeriodEnd": 1 });
  console.log("  índices → asegurados (createIndex es idempotente)");
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

  console.log("\nusers.emailVerified");
  await backfillEmailVerified(db, apply);

  console.log("\níndices");
  await ensureIndexes(db, apply);

  await mongoose.disconnect();
  console.log(apply ? "\nMigración aplicada." : "\nDry-run completado. Nada fue modificado.");
  console.log(
    "\nRecordatorio manual (no lo hace este script): correr esto ANTES de desplegar el gate de " +
      "requireVerifiedEmail — si el gate llega primero, los usuarios existentes quedan bloqueados hasta que corra."
  );
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
