import { Request, Response } from "express";
import crypto from "crypto";
import TournamentModel from "../models/Tournament";
import TournamentLogoModel from "../models/TournamentLogo";
import { validateImageBuffer } from "../utils/imageValidation";
import { canManageTournament } from "../utils/tournamentAccess";

interface AuthRequest extends Request {
  user?: string;
}

/**
 * El logo es cosmético y no afecta la lógica del torneo, así que —a diferencia
 * de `updateTournament`— se puede cambiar en cualquier estado, incluso con el
 * torneo en curso o terminado. El permiso es el mismo que para gestionar el
 * resto del torneo (ver `utils/tournamentAccess.ts`).
 */

/** Hash corto del contenido: cambia con la imagen y sirve de cache buster. */
const buildVersion = (buffer: Buffer): string =>
  crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12);

/**
 * Sirve el binario del logo.
 *
 * Deliberadamente público: un `<img src>` no puede enviar el header
 * `Authorization`, así que un endpoint autenticado sería inutilizable desde el
 * HTML. Además `/live/:id` ya es una vista sin sesión por diseño. El logo es
 * información pública, igual que el nombre del torneo.
 */
export const getTournamentLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const logo = await TournamentLogoModel.findOne({ tournamentId: req.params.id });
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
  } catch (error) {
    res.status(400).json({ message: "Error al obtener el logo", error });
  }
};

/** Crea o reemplaza el logo del torneo. Espera `multipart/form-data`, campo `logo`. */
export const uploadTournamentLogo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      return void res.status(400).json({ message: "No se recibió ninguna imagen" });
    }

    const tournament = await TournamentModel.findById(req.params.id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res
        .status(403)
        .json({ message: "No tenés permisos para cambiar el logo de este torneo" });
    }

    const validation = validateImageBuffer(file.buffer, file.mimetype);
    if (!validation.ok) {
      return void res.status(400).json({ message: validation.message });
    }

    const version = buildVersion(file.buffer);

    await TournamentLogoModel.findOneAndUpdate(
      { tournamentId: tournament._id },
      {
        tournamentId: tournament._id,
        data: file.buffer,
        mimeType: validation.mimeType,
        size: file.buffer.length,
        version
      },
      { upsert: true, new: true }
    );

    tournament.logo = { version, mimeType: validation.mimeType, size: file.buffer.length };
    await tournament.save();

    res.status(200).json({ logo: tournament.logo });
  } catch (error) {
    res.status(400).json({ message: "Error al guardar el logo", error });
  }
};

export const deleteTournamentLogo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournament = await TournamentModel.findById(req.params.id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res
        .status(403)
        .json({ message: "No tenés permisos para quitar el logo de este torneo" });
    }

    await TournamentLogoModel.deleteOne({ tournamentId: tournament._id });

    tournament.logo = null;
    await tournament.save();

    res.status(200).json({ message: "Logo eliminado", logo: null });
  } catch (error) {
    res.status(400).json({ message: "Error al eliminar el logo", error });
  }
};
