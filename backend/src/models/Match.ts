import mongoose, { Schema, Document } from "mongoose";
import { MATCH_TYPES, MATCH_STATUS } from "../config/constants";

/**
 * `phase` y `bracketSlot` ya no son un enum fijo: los genera `utils/bracket.ts`
 * según la cantidad de equipos del torneo (`${posLow}-${posHigh}#${indice}`,
 * con el alias legacy QF1/SFG1/FG/etc. para los torneos de 8 equipos). La
 * validación real es "¿existe como nodo del cuadro de este torneo?", no un
 * enum — por eso el schema los guarda como `String` libre.
 */
export type MatchPhase = string;
export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];
export type BracketSlot = string;

export interface IMatchPlayer {
  playerId?: mongoose.Types.ObjectId;
  username?: string;
  isGuest?: boolean;
}

export interface IMatchTeam {
  teamId: mongoose.Types.ObjectId;
  score: number;
  players: IMatchPlayer[];
}

export interface IMatch extends Document {
  tournament?: mongoose.Types.ObjectId | string;
  teams: IMatchTeam[];
  winner?: mongoose.Types.ObjectId;
  losingTeam?: mongoose.Types.ObjectId;
  status: MatchStatus;
  type: "friendly" | "tournament";
  phase?: MatchPhase;
  bracketSlot?: BracketSlot;
  feedsWinnerTo?: mongoose.Types.ObjectId;
  feedsLoserTo?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: false
    },
    teams: [
      {
        teamId: { type: mongoose.Schema.Types.ObjectId },
        score: { type: Number, default: 0, min: 0 },
        players: [
          {
            playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            username: { type: String, required: false },
            isGuest: { type: Boolean, default: false }
          }
        ]
      }
    ],
    winner: { type: Schema.Types.ObjectId, required: false },
    losingTeam: { type: Schema.Types.ObjectId, required: false },
    status: {
      type: String,
      enum: Object.values(MATCH_STATUS),
      default: MATCH_STATUS.IN_PROGRESS
    },
    type: {
      type: String,
      enum: Object.values(MATCH_TYPES),
      default: MATCH_TYPES.FRIENDLY
    },
    // Sin `enum`: el universo de slots/phases válidos depende de la cantidad
    // de equipos del torneo (ver `utils/bracket.ts`), no es una lista fija.
    phase: { type: String, required: false },
    bracketSlot: { type: String, required: false },
    feedsWinnerTo: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: false },
    feedsLoserTo: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "matches", timestamps: true }
);

MatchSchema.index({ status: 1 });
MatchSchema.index({ tournament: 1, bracketSlot: 1, status: 1 });
// Historial y estadísticas de un jugador (user.controller/getUserMatches,
// utils/userStats): sin este índice cada consulta es un COLLSCAN completo
// de la colección. Multikey porque playerId vive dentro de un array anidado.
MatchSchema.index({ "teams.players.playerId": 1, createdAt: -1 });

const Match = mongoose.model<IMatch>("Match", MatchSchema, "matches");

export default Match;
