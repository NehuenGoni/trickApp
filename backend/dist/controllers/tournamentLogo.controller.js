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
exports.deleteTournamentLogo = exports.uploadTournamentLogo = exports.getTournamentLogo = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Tournament_1 = __importDefault(require("../models/Tournament"));
const TournamentLogo_1 = __importDefault(require("../models/TournamentLogo"));
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const imageValidation_1 = require("../utils/imageValidation");
/**
 * El logo es cosmético y no afecta la lógica del torneo, así que —a diferencia
 * de `updateTournament`— se puede cambiar en cualquier estado, incluso con el
 * torneo en curso o terminado. Lo único que se exige es ser el creador o admin.
 */
const canManageLogo = (tournament, req) => { var _a; return tournament.createdBy.toString() === req.user || (0, roleMiddleware_1.isAdmin)((_a = req.authUser) === null || _a === void 0 ? void 0 : _a.role); };
/** Hash corto del contenido: cambia con la imagen y sirve de cache buster. */
const buildVersion = (buffer) => crypto_1.default.createHash("sha1").update(buffer).digest("hex").slice(0, 12);
/**
 * Sirve el binario del logo.
 *
 * Deliberadamente público: un `<img src>` no puede enviar el header
 * `Authorization`, así que un endpoint autenticado sería inutilizable desde el
 * HTML. Además `/live/:id` ya es una vista sin sesión por diseño. El logo es
 * información pública, igual que el nombre del torneo.
 */
const getTournamentLogo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const logo = yield TournamentLogo_1.default.findOne({ tournamentId: req.params.id });
        if (!logo) {
            return void res.status(404).json({ message: "Este torneo no tiene logo" });
        }
        res.set("Content-Type", logo.mimeType);
        res.set("Content-Length", String(logo.size));
        // Seguro gracias al `?v=<version>` que agrega el frontend: al cambiar el
        // logo cambia la URL, así que el cache eterno nunca sirve una imagen vieja.
        res.set("Cache-Control", "public, max-age=31536000, immutable");
        res.set("ETag", `"${logo.version}"`);
        if (req.headers["if-none-match"] === `"${logo.version}"`) {
            return void res.status(304).end();
        }
        res.status(200).send(logo.data);
    }
    catch (error) {
        res.status(400).json({ message: "Error al obtener el logo", error });
    }
});
exports.getTournamentLogo = getTournamentLogo;
/** Crea o reemplaza el logo del torneo. Espera `multipart/form-data`, campo `logo`. */
const uploadTournamentLogo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const file = req.file;
        if (!file) {
            return void res.status(400).json({ message: "No se recibió ninguna imagen" });
        }
        const tournament = yield Tournament_1.default.findById(req.params.id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (!canManageLogo(tournament, req)) {
            return void res
                .status(403)
                .json({ message: "Solo el creador del torneo o un admin pueden cambiar el logo" });
        }
        const validation = (0, imageValidation_1.validateImageBuffer)(file.buffer, file.mimetype);
        if (!validation.ok) {
            return void res.status(400).json({ message: validation.message });
        }
        const version = buildVersion(file.buffer);
        yield TournamentLogo_1.default.findOneAndUpdate({ tournamentId: tournament._id }, {
            tournamentId: tournament._id,
            data: file.buffer,
            mimeType: validation.mimeType,
            size: file.buffer.length,
            version
        }, { upsert: true, new: true });
        tournament.logo = { version, mimeType: validation.mimeType, size: file.buffer.length };
        yield tournament.save();
        res.status(200).json({ logo: tournament.logo });
    }
    catch (error) {
        res.status(400).json({ message: "Error al guardar el logo", error });
    }
});
exports.uploadTournamentLogo = uploadTournamentLogo;
const deleteTournamentLogo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournament = yield Tournament_1.default.findById(req.params.id);
        if (!tournament) {
            return void res.status(404).json({ message: "Torneo no encontrado" });
        }
        if (!canManageLogo(tournament, req)) {
            return void res
                .status(403)
                .json({ message: "Solo el creador del torneo o un admin pueden quitar el logo" });
        }
        yield TournamentLogo_1.default.deleteOne({ tournamentId: tournament._id });
        tournament.logo = null;
        yield tournament.save();
        res.status(200).json({ message: "Logo eliminado", logo: null });
    }
    catch (error) {
        res.status(400).json({ message: "Error al eliminar el logo", error });
    }
});
exports.deleteTournamentLogo = deleteTournamentLogo;
