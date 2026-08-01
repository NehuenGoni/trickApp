import mongoose, { Schema, model, Document } from "mongoose";
import { AllowedLogoMimeType, ALLOWED_LOGO_MIME_TYPES } from "../config/constants";

/**
 * El binario del logo vive en su propia colección, separado de la liga, por la
 * misma razón que `TournamentLogo`: `GET /leagues` devuelve documentos
 * completos sin proyección, y no queremos arrastrar binarios en cada listado.
 * En `League` queda solo la metadata (`logo`).
 */
export interface ILeagueLogo extends Document {
  leagueId: mongoose.Types.ObjectId;
  data: Buffer;
  mimeType: AllowedLogoMimeType;
  size: number;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

const leagueLogoSchema = new Schema<ILeagueLogo>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: "League",
      required: true,
      unique: true,
      index: true
    },
    data: { type: Buffer, required: true },
    mimeType: {
      type: String,
      enum: ALLOWED_LOGO_MIME_TYPES,
      required: true
    },
    size: { type: Number, required: true },
    /** Hash corto del buffer. Se usa como cache buster en la URL (`?v=`). */
    version: { type: String, required: true }
  },
  { collection: "leaguelogos", timestamps: true }
);

const LeagueLogoModel = model<ILeagueLogo>("LeagueLogo", leagueLogoSchema);

export default LeagueLogoModel;
