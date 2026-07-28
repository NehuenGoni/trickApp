import mongoose, { Schema, model, Document } from "mongoose";
import { AllowedLogoMimeType, ALLOWED_LOGO_MIME_TYPES } from "../config/constants";

/**
 * El binario del logo vive en su propia colección, separado del torneo.
 *
 * `GET /tournaments` hace un `find()` sin proyección y devuelve el documento
 * entero de cada torneo: si el buffer estuviera embebido, cada carga de la
 * lista arrastraría todos los logos. En `Tournament` queda solo la metadata
 * (`logo`), suficiente para saber si hay imagen y con qué versión pedirla.
 */
export interface ITournamentLogo extends Document {
  tournamentId: mongoose.Types.ObjectId;
  data: Buffer;
  mimeType: AllowedLogoMimeType;
  size: number;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentLogoSchema = new Schema<ITournamentLogo>(
  {
    tournamentId: {
      type: Schema.Types.ObjectId,
      ref: "Tournament",
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
  { collection: "tournamentlogos", timestamps: true }
);

const TournamentLogoModel = model<ITournamentLogo>("TournamentLogo", tournamentLogoSchema);

export default TournamentLogoModel;
