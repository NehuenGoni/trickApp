import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ALLOWED_LOGO_MIME_TYPES, MAX_LOGO_BYTES } from "../config/constants";

/**
 * El archivo se mantiene en memoria: los logos pesan decenas de KB y van
 * derecho a Mongo, así que no hay motivo para tocar el disco (que además no
 * persiste en hosts efímeros).
 *
 * `limits.fileSize` corta el stream apenas se pasa del límite, antes de
 * bufferizar el archivo entero: el tope de tamaño se aplica sin gastar la
 * memoria que se quiere evitar.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!(ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
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
export const uploadLogo = (req: Request, res: Response, next: NextFunction): void => {
  upload.single("logo")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        const maxKb = Math.round(MAX_LOGO_BYTES / 1024);
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

export default uploadLogo;
