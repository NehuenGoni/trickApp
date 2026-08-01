import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import League from "../models/League";
import LeagueLogoModel from "../models/LeagueLogo";
import { canManageLeague } from "../utils/leaguePermissions";
import { validateImageBuffer } from "../utils/imageValidation";

/** Hash corto del contenido: cambia con la imagen y sirve de cache buster. */
const buildVersion = (buffer: Buffer): string =>
  crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12);

/**
 * Sirve el binario del logo.
 *
 * Deliberadamente público, igual que el de torneos: un `<img src>` no puede
 * mandar el header `Authorization`, y el logo es información pública igual
 * que el nombre de la liga.
 */
export const getLeagueLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const logo = await LeagueLogoModel.findOne({ leagueId: req.params.id });
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
  } catch (error: any) {
    res.status(400).json({ message: "Error al obtener el logo", error: error.message });
  }
};

/** Crea o reemplaza el logo de la liga. Espera `multipart/form-data`, campo `logo`. */
export const uploadLeagueLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No se recibió ninguna imagen" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    const validation = validateImageBuffer(file.buffer, file.mimetype);
    if (!validation.ok) {
      res.status(400).json({ message: validation.message });
      return;
    }

    const version = buildVersion(file.buffer);

    await LeagueLogoModel.findOneAndUpdate(
      { leagueId: league._id },
      {
        leagueId: league._id,
        data: file.buffer,
        mimeType: validation.mimeType,
        size: file.buffer.length,
        version
      },
      { upsert: true, new: true }
    );

    league.logo = { version, mimeType: validation.mimeType, size: file.buffer.length };
    await league.save();

    res.status(200).json({ logo: league.logo });
  } catch (error: any) {
    res.status(400).json({ message: "Error al guardar el logo", error: error.message });
  }
};

export const deleteLeagueLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    await LeagueLogoModel.deleteOne({ leagueId: league._id });

    league.logo = null;
    await league.save();

    res.status(200).json({ message: "Logo eliminado", logo: null });
  } catch (error: any) {
    res.status(400).json({ message: "Error al eliminar el logo", error: error.message });
  }
};
