"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLogo = void 0;
const multer_1 = __importDefault(require("multer"));
const constants_1 = require("../config/constants");
/**
 * El archivo se mantiene en memoria: los logos pesan decenas de KB y van
 * derecho a Mongo, así que no hay motivo para tocar el disco (que además no
 * persiste en hosts efímeros).
 *
 * `limits.fileSize` corta el stream apenas se pasa del límite, antes de
 * bufferizar el archivo entero: el tope de tamaño se aplica sin gastar la
 * memoria que se quiere evitar.
 */
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: constants_1.MAX_LOGO_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (!constants_1.ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
            // Primer filtro, barato. La validación real es por magic bytes en
            // `validateImageBuffer`: el mimetype que manda el cliente no es confiable.
            return cb(new Error("Formato no permitido. Se aceptan WebP, PNG o JPEG"));
        }
        cb(null, true);
    }
});
/**
 * Envuelve `upload.single('logo')` para traducir los errores de multer a
 * respuestas JSON en español, en línea con el resto de la API.
 */
const uploadLogo = (req, res, next) => {
    upload.single("logo")(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                const maxKb = Math.round(constants_1.MAX_LOGO_BYTES / 1024);
                return void res
                    .status(413)
                    .json({ message: `La imagen supera el máximo de ${maxKb} KB` });
            }
            return void res.status(400).json({ message: `Error al subir la imagen: ${err.message}` });
        }
        if (err) {
            const message = err instanceof Error ? err.message : "Error al subir la imagen";
            return void res.status(400).json({ message });
        }
        next();
    });
};
exports.uploadLogo = uploadLogo;
exports.default = exports.uploadLogo;
