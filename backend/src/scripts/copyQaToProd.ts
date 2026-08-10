import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/**
 * Copia fiel de QA (MONGO_URI, hoy "testTrickApp") a producción (MONGO_URI_PROD,
 * "trickApp") para un subconjunto fijo de colecciones. `payments` y `subscriptions`
 * quedan siempre excluidas: nunca se leen de QA ni se escriben en destino. Como
 * guardrail adicional, antes de hacer nada más se verifica que sigan vacías en
 * destino; si tienen documentos, el script aborta sin tocar nada.
 *
 * Uso:
 *   npx ts-node src/scripts/copyQaToProd.ts --confirm-source=testTrickApp --confirm-target=trickApp
 *   npx ts-node src/scripts/copyQaToProd.ts --confirm-source=testTrickApp --confirm-target=trickApp --apply
 *
 * Sin --apply hace dry-run (solo cuenta documentos, no escribe nada).
 */
const COLLECTIONS_TO_COPY = [
  "users",
  "tournaments",
  "matches",
  "leagues",
  "pricingconfigs",
  "tournamentlogos",
  "leaguelogos"
];

const UNTOUCHED_COLLECTIONS = ["payments", "subscriptions"];

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmSourceArg = args.find((a) => a.startsWith("--confirm-source="));
  const confirmTargetArg = args.find((a) => a.startsWith("--confirm-target="));
  return {
    apply,
    confirmSource: confirmSourceArg?.split("=")[1],
    confirmTarget: confirmTargetArg?.split("=")[1]
  };
}

async function run() {
  const { apply, confirmSource, confirmTarget } = parseArgs();
  if (!confirmSource || !confirmTarget) {
    console.error("Uso: --confirm-source=<nombre-origen> --confirm-target=<nombre-destino> [--apply]");
    process.exit(1);
  }

  const sourceURI = process.env.MONGO_URI;
  const targetURI = process.env.MONGO_URI_PROD;
  if (!sourceURI) {
    console.error("MONGO_URI no está definida en .env");
    process.exit(1);
  }
  if (!targetURI) {
    console.error("MONGO_URI_PROD no está definida en .env");
    process.exit(1);
  }

  const sourceConn = await mongoose.createConnection(sourceURI).asPromise();
  const targetConn = await mongoose.createConnection(targetURI).asPromise();

  const sourceDb = sourceConn.db;
  const targetDb = targetConn.db;
  if (!sourceDb || !targetDb) {
    console.error("No se pudo obtener el handle de alguna de las bases de datos");
    process.exit(1);
  }

  if (sourceConn.name !== confirmSource) {
    console.error(`La base de origen conectada es "${sourceConn.name}", pero pediste --confirm-source=${confirmSource}. Abortando.`);
    await sourceConn.close();
    await targetConn.close();
    process.exit(1);
  }
  if (targetConn.name !== confirmTarget) {
    console.error(`La base de destino conectada es "${targetConn.name}", pero pediste --confirm-target=${confirmTarget}. Abortando.`);
    await sourceConn.close();
    await targetConn.close();
    process.exit(1);
  }

  console.log(`Origen: ${sourceConn.name}  →  Destino: ${targetConn.name}`);

  // Guardrail: payments/subscriptions nunca se tocan. Si ya tienen datos en
  // destino, algo no coincide con lo esperado y se aborta sin escribir nada.
  for (const name of UNTOUCHED_COLLECTIONS) {
    const count = await targetDb.collection(name).countDocuments();
    if (count > 0) {
      console.error(
        `"${name}" tiene ${count} documento(s) en destino (${targetConn.name}). Este script nunca toca ` +
          `payments/subscriptions — abortando sin hacer ningún cambio. Revisá manualmente antes de continuar.`
      );
      await sourceConn.close();
      await targetConn.close();
      process.exit(1);
    }
    console.log(`  [chequeo] ${name}: 0 documento(s) en destino, como se esperaba (no se toca).`);
  }

  console.log(apply ? "\nMODO: COPIANDO (--apply)" : "\nMODO: DRY-RUN (no se escribe nada)");

  for (const name of COLLECTIONS_TO_COPY) {
    const sourceCollection = sourceDb.collection(name);
    const targetCollection = targetDb.collection(name);
    const docs = await sourceCollection.find({}).toArray();
    const currentTargetCount = await targetCollection.countDocuments();

    if (!apply) {
      console.log(`  [dry-run] ${name}: origen=${docs.length} documento(s), destino actual=${currentTargetCount} → se reemplazaría por ${docs.length}`);
      continue;
    }

    await targetCollection.deleteMany({});
    if (docs.length > 0) await targetCollection.insertMany(docs);
    console.log(`  ${name}: copiados ${docs.length} documento(s) (destino tenía ${currentTargetCount})`);
  }

  await sourceConn.close();
  await targetConn.close();
  console.log(apply ? "\nCopia completada." : "\nDry-run completado. Nada fue modificado.");
}

run().catch((err) => {
  console.error("Error en copia QA → producción:", err);
  process.exit(1);
});
