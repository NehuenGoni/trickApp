import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

dotenv.config();

/**
 * Backup de emergencia cuando no está disponible `mongodump` (Database Tools
 * de MongoDB) en el entorno. Vuelca cada colección completa a un .json con
 * EJSON (preserva tipos: ObjectId, Date, etc.) para poder restaurar 1:1 con
 * restoreProdRaw.ts. Pensado para bases chicas — no usar en colecciones de
 * millones de documentos.
 *
 * Uso: npx ts-node src/scripts/backupProdRaw.ts --confirm-db=trickApp
 */
const COLLECTIONS = ["users", "tournaments", "matches", "leagues"];

function parseArgs() {
  const args = process.argv.slice(2);
  const confirmDbArg = args.find((a) => a.startsWith("--confirm-db="));
  return { confirmDb: confirmDbArg?.split("=")[1] };
}

async function run() {
  const { confirmDb } = parseArgs();
  if (!confirmDb) {
    console.error("Falta --confirm-db=<nombre-de-base>.");
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
    console.error(`La base conectada es "${mongoose.connection.name}", pero pediste --confirm-db=${confirmDb}. Abortando.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", "..", "backups", `${confirmDb}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Conectado a MongoDB — base: ${mongoose.connection.name}`);
  console.log(`Backup en: ${outDir}\n`);

  const { EJSON } = require("bson") as typeof import("bson");

  for (const name of COLLECTIONS) {
    const collection = db.collection(name);
    const docs = await collection.find({}).toArray();
    const filePath = path.join(outDir, `${name}.json`);
    fs.writeFileSync(filePath, EJSON.stringify(docs, undefined, 2), "utf-8");
    console.log(`  ${name}: ${docs.length} documento(s) → ${filePath}`);
  }

  await mongoose.disconnect();
  console.log("\nBackup completado.");
}

run().catch((err) => {
  console.error("Error en backup:", err);
  process.exit(1);
});
