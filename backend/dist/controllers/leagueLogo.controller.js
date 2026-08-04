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
exports.deleteLeagueLogo = exports.uploadLeagueLogo = exports.getLeagueLogo = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const League_1 = __importDefault(require("../models/League"));
const LeagueLogo_1 = __importDefault(require("../models/LeagueLogo"));
const leaguePermissions_1 = require("../utils/leaguePermissions");
const imageValidation_1 = require("../utils/imageValidation");
/** Hash corto del contenido: cambia con la imagen y sirve de cache buster. */
const buildVersion = (buffer) => crypto_1.default.createHash("sha1").update(buffer).digest("hex").slice(0, 12);
/**
 * Sirve el binario del logo.
 *
 * Deliberadamente público, igual que el de torneos: un `<img src>` no puede
 * mandar el header `Authorization`, y el logo es información pública igual
 * que el nombre de la liga.
 */
const getLeagueLogo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const logo = yield LeagueLogo_1.default.findOne({ leagueId: req.params.id });
        if (!logo) {
            res.status(404).json({ message: "Esta liga no tiene logo" });
            return;
        }
        res.set("Content-Type", logo.mimeType);
        res.set("Content-Length", String(logo.size));
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        res.set("ETag", `"${logo.version}"`);
        if (req.headers["if-none-match"] === `"${logo.version}"`) {
            res.status(304).end();
            return;
        }
        res.status(200).send(logo.data);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener el logo", error: error.message });
    }
});
exports.getLeagueLogo = getLeagueLogo;
/** Crea o reemplaza el logo de la liga. Espera `multipart/form-data`, campo `logo`. */
const uploadLeagueLogo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "ID de liga inválido" });
            return;
        }
        const file = req.file;
        if (!file) {
            res.status(400).json({ message: "No se recibió ninguna imagen" });
            return;
        }
        const league = yield League_1.default.findById(id);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        if (!(0, leaguePermissions_1.canManageLeague)(req.authUser, league)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        const validation = (0, imageValidation_1.validateImageBuffer)(file.buffer, file.mimetype);
        if (!validation.ok) {
            res.status(400).json({ message: validation.message });
            return;
        }
        const version = buildVersion(file.buffer);
        yield LeagueLogo_1.default.findOneAndUpdate({ leagueId: league._id }, {
            leagueId: league._id,
            data: file.buffer,
            mimeType: validation.mimeType,
            size: file.buffer.length,
            version
        }, { upsert: true, new: true });
        league.logo = { version, mimeType: validation.mimeType, size: file.buffer.length };
        yield league.save();
        res.status(200).json({ logo: league.logo });
    }
    catch (error) {
        res.status(400).json({ message: "Error al guardar el logo", error: error.message });
    }
});
exports.uploadLeagueLogo = uploadLeagueLogo;
const deleteLeagueLogo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "ID de liga inválido" });
            return;
        }
        const league = yield League_1.default.findById(id);
        if (!league) {
            res.status(404).json({ message: "Liga no encontrada" });
            return;
        }
        if (!(0, leaguePermissions_1.canManageLeague)(req.authUser, league)) {
            res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
            return;
        }
        yield LeagueLogo_1.default.deleteOne({ leagueId: league._id });
        league.logo = null;
        yield league.save();
        res.status(200).json({ message: "Logo eliminado", logo: null });
    }
    catch (error) {
        res.status(400).json({ message: "Error al eliminar el logo", error: error.message });
    }
});
exports.deleteLeagueLogo = deleteLeagueLogo;
