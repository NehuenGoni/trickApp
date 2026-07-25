import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

dotenv.config();

/**
 * Restaura un backup generado por backupProdRaw.ts. Por colección, borra lo
 * que haya en destino e inserta el contenido del .json (restore completo,
 * no un merge). Pensado como red de seguridad si migrateProdToLatest.ts
 * necesitara revertirse.
 *
 * Uso: npx ts-node src/scripts/restoreProdRaw.ts --confirm-db=trickApp --from=backend/backups/trickApp-2026-07-25T.../ --apply
 * Sin --apply hace dry-run (solo cuenta documentos por archivo).
 */
const COLLECTIONS = ["users", "tournaments", "matches", "leagues"];

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmDbArg = args.find((a) => a.startsWith("--confirm-db="));
  const fromArg = args.find((a) => a.startsWith("--from="));
  return {
    apply,
    confirmDb: confirmDbArg?.split("=")[1],
    from: fromArg?.split("=")[1]
  };
}

async function run() {
  const { apply, confirmDb, from } = parseArgs();
  if (!confirmDb || !from) {
    console.error("Uso: --confirm-db=<nombre> --from=<carpeta-de-backup> [--apply]");
    process.exit(1);
  }
  if (!fs.existsSync(from)) {
    console.error(`No existe la carpeta de backup: ${from}`);
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

  console.log(`Conectado a MongoDB — base: ${mongoose.connection.name}`);
  console.log(apply ? "MODO: RESTAURANDO (--apply)" : "MODO: DRY-RUN (no se escribe nada)");

  const { EJSON } = require("bson") as typeof import("bson");

  for (const name of COLLECTIONS) {
    const filePath = path.join(from, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`  ${name}: no hay archivo de backup, se omite`);
      continue;
    }
    const docs = EJSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>[];
    if (!apply) {
      console.log(`  [dry-run] ${name}: restauraría ${docs.length} documento(s) (deleteMany + insertMany)`);
      continue;
    }
    const collection = db.collection(name);
    await collection.deleteMany({});
    if (docs.length > 0) await collection.insertMany(docs as any[]);
    console.log(`  ${name}: restaurados ${docs.length} documento(s)`);
  }

  await mongoose.disconnect();
  console.log(apply ? "\nRestore completado." : "\nDry-run completado. Nada fue modificado.");
}

run().catch((err) => {
  console.error("Error en restore:", err);
  process.exit(1);
});
