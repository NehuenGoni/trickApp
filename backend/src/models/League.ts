import mongoose, { Schema, Document } from "mongoose";

/**
 * Metadata del logo. El binario vive en la colección `leaguelogos` (ver
 * `models/LeagueLogo.ts`); acá solo queda lo necesario para armar la URL con
 * cache buster sin un round-trip extra. Mismo esquema que `ITournamentLogoMeta`.
 */
export interface ILeagueLogoMeta {
  version: string;
  mimeType: string;
  size: number;
}

/**
 * Una liga es solo un agrupador de torneos con nombre y fechas. No guarda
 * `tournaments[]` ni una tabla de posiciones materializada (`userStats[]`,
 * como existía antes): el vínculo vive del lado del torneo (`Tournament.league`)
 * y la tabla de posiciones se calcula al vuelo con `computeLeagueStandings`
 * (ver `utils/leagueStandings.ts`) a partir de los `playerStats` de sus
 * torneos completados.
 *
 * La razón es que un dato derivado no puede desincronizarse: si un torneo se
 * borra, se resetea o se recalcula, la liga queda correcta sin tocar una
 * sola línea de código acá. La versión vieja necesitaba parches ad-hoc en la
 * cascada de borrado de torneos (`Math.min` sobre `tournamentsPlayed`) para
 * no quedar inconsistente; con este diseño ese problema no puede existir.
 */
export interface ILeague extends Document {
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  /**
   * Usuarios designados por el dueño de la liga (`createdBy`) para operar sus
   * torneos con los mismos permisos que él (sortear, iniciar, cargar
   * resultados, inscribir/quitar jugadores) sin poder editar ni borrar la
   * liga en sí. Ver `utils/tournamentAccess.ts`.
   */
  organizers: mongoose.Types.ObjectId[];
  logo?: ILeagueLogoMeta | null;
  createdAt: Date;
  updatedAt: Date;
}

const LeagueLogoMetaSchema = new Schema<ILeagueLogoMeta>(
  {
    version: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const LeagueSchema = new Schema<ILeague>(
  {
    name: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizers: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    logo: { type: LeagueLogoMetaSchema, default: null },
  },
  { timestamps: true }
);

LeagueSchema.index({ name: 1 });

const League = mongoose.model<ILeague>("League", LeagueSchema);

export default League;
