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
        confirmDb: confirmDbArg === null || confirmDbArg === void 0 ? void 0 : confirmDbArg.split("=")[1],
        from: fromArg === null || fromArg === void 0 ? void 0 : fromArg.split("=")[1]
    };
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const { apply, confirmDb, from } = parseArgs();
        if (!confirmDb || !from) {
            console.error("Uso: --confirm-db=<nombre> --from=<carpeta-de-backup> [--apply]");
            process.exit(1);
        }
        if (!fs_1.default.existsSync(from)) {
            console.error(`No existe la carpeta de backup: ${from}`);
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
        console.log(`Conectado a MongoDB — base: ${mongoose_1.default.connection.name}`);
        console.log(apply ? "MODO: RESTAURANDO (--apply)" : "MODO: DRY-RUN (no se escribe nada)");
        const { EJSON } = require("bson");
        for (const name of COLLECTIONS) {
            const filePath = path_1.default.join(from, `${name}.json`);
            if (!fs_1.default.existsSync(filePath)) {
                console.log(`  ${name}: no hay archivo de backup, se omite`);
                continue;
            }
            const docs = EJSON.parse(fs_1.default.readFileSync(filePath, "utf-8"));
            if (!apply) {
                console.log(`  [dry-run] ${name}: restauraría ${docs.length} documento(s) (deleteMany + insertMany)`);
                continue;
            }
            const collection = db.collection(name);
            yield collection.deleteMany({});
            if (docs.length > 0)
                yield collection.insertMany(docs);
            console.log(`  ${name}: restaurados ${docs.length} documento(s)`);
        }
        yield mongoose_1.default.disconnect();
        console.log(apply ? "\nRestore completado." : "\nDry-run completado. Nada fue modificado.");
    });
}
run().catch((err) => {
    console.error("Error en restore:", err);
    process.exit(1);
});
