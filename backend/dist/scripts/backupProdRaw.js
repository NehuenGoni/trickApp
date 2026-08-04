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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
dotenv_1.default.config();
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
    return { confirmDb: confirmDbArg === null || confirmDbArg === void 0 ? void 0 : confirmDbArg.split("=")[1] };
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
        yield mongoose_1.default.connect(mongoURI);
        const db = mongoose_1.default.connection.db;
        if (!db) {
            console.error("No se pudo obtener el handle de la base de datos");
            process.exit(1);
        }
        if (mongoose_1.default.connection.name !== confirmDb) {
            console.error(`La base conectada es "${mongoose_1.default.connection.name}", pero pediste --confirm-db=${confirmDb}. Abortando.`);
            yield mongoose_1.default.disconnect();
            process.exit(1);
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const outDir = path_1.default.join(__dirname, "..", "..", "backups", `${confirmDb}-${stamp}`);
        fs_1.default.mkdirSync(outDir, { recursive: true });
        console.log(`Conectado a MongoDB — base: ${mongoose_1.default.connection.name}`);
        console.log(`Backup en: ${outDir}\n`);
        const { EJSON } = require("bson");
        for (const name of COLLECTIONS) {
            const collection = db.collection(name);
            const docs = yield collection.find({}).toArray();
            const filePath = path_1.default.join(outDir, `${name}.json`);
            fs_1.default.writeFileSync(filePath, EJSON.stringify(docs, undefined, 2), "utf-8");
            console.log(`  ${name}: ${docs.length} documento(s) → ${filePath}`);
        }
        yield mongoose_1.default.disconnect();
        console.log("\nBackup completado.");
    });
}
run().catch((err) => {
    console.error("Error en backup:", err);
    process.exit(1);
});
