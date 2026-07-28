import mongoose, { Schema, model, Document } from "mongoose";
import {
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  TEAM_FORMATION_MODES,
  GUEST_DRAW_MODES
} from "../config/constants";

export type TournamentType = typeof TOURNAMENT_TYPES[keyof typeof TOURNAMENT_TYPES];
export type TournamentFormat = typeof TOURNAMENT_FORMATS[keyof typeof TOURNAMENT_FORMATS];
export type TeamFormationMode = typeof TEAM_FORMATION_MODES[keyof typeof TEAM_FORMATION_MODES];
export type GuestDrawMode = typeof GUEST_DRAW_MODES[keyof typeof GUEST_DRAW_MODES];

export interface IPlayer {
  playerId?: mongoose.Types.ObjectId;
  name: string;
  isGuest?: boolean;
}

export interface ITeam {
  teamId: mongoose.Types.ObjectId;
  name: string;
  registeredBy?: mongoose.Types.ObjectId;
  players: IPlayer[];
  isDrawn?: boolean;
}

export interface IIndividualSignup {
  signupId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  name: string;
  isGuest: boolean;
}

export interface IPlayerStat {
  playerId?: mongoose.Types.ObjectId;
  name: string;
  isGuest: boolean;
  position: number;
  points: number;
}

/**
 * Metadata del logo. El binario vive en la colección `tournamentlogos`
 * (ver `models/TournamentLogo.ts`); acá solo queda lo necesario para armar
 * la URL con cache buster sin un round-trip extra.
 */
export interface ITournamentLogoMeta {
  version: string;
  mimeType: string;
  size: number;
}

export interface ITournament extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  type: TournamentType;
  format: TournamentFormat;
  teamFormationMode: TeamFormationMode;
  guestDrawMode: GuestDrawMode;
  teams: ITeam[];
  individualSignups: IIndividualSignup[];
  draftPairOrder?: mongoose.Types.ObjectId[];
  matches: mongoose.Types.ObjectId[];
  playerStats: IPlayerStat[];
  pointsAwarded: boolean;
  numberOfTeams: number;
  createdAt: Date;
  startDate: Date;
  description?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  logo?: ITournamentLogoMeta | null;
}

const PlayerSchema = new Schema<IPlayer>({
  playerId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return !this.isGuest;
    }
  },
  name: { type: String, required: false },
  isGuest: { type: Boolean, default: false }
});

const TeamSchema = new Schema<ITeam>({
  teamId: { type: Schema.Types.ObjectId, auto: true },
  name: { type: String, required: true },
  registeredBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  players: { type: [PlayerSchema], required: true },
  isDrawn: { type: Boolean, default: false },
});

const IndividualSignupSchema = new Schema<IIndividualSignup>({
  signupId: { type: Schema.Types.ObjectId, auto: true },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: function (this: IIndividualSignup) { return !this.isGuest; }
  },
  name: { type: String, required: true },
  isGuest: { type: Boolean, default: false }
}, { _id: false });

const PlayerStatSchema = new Schema<IPlayerStat>({
  playerId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  name: { type: String, required: true },
  isGuest: { type: Boolean, default: false },
  position: { type: Number, required: true, min: 1, max: 8 },
  points: { type: Number, required: true, min: 0 }
}, { _id: false });

const LogoMetaSchema = new Schema<ITournamentLogoMeta>({
  version: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true }
}, { _id: false });

const tournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: Object.values(TOURNAMENT_TYPES),
      required: true,
      default: TOURNAMENT_TYPES.MASTER_1000
    },
    format: {
      type: String,
      enum: Object.values(TOURNAMENT_FORMATS),
      required: true,
      default: TOURNAMENT_FORMATS.DUOS
    },
    teamFormationMode: {
      type: String,
      enum: Object.values(TEAM_FORMATION_MODES),
      required: true,
      default: TEAM_FORMATION_MODES.USER_FORMED
    },
    guestDrawMode: {
      type: String,
      enum: Object.values(GUEST_DRAW_MODES),
      required: true,
      default: GUEST_DRAW_MODES.GROUPED
    },
    teams: { type: [TeamSchema], default: [] },
    individualSignups: { type: [IndividualSignupSchema], default: [] },
    draftPairOrder: { type: [Schema.Types.ObjectId], default: undefined },
    startDate: { type: Date, required: true },
    description: { type: String },
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Match" }],
    playerStats: { type: [PlayerStatSchema], default: [] },
    pointsAwarded: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['upcoming', 'in_progress', 'completed'],
      default: 'upcoming'
    },
    // Los torneos creados antes de esta feature simplemente no tienen el campo:
    // se leen como `null` y el frontend cae al fallback de iniciales.
    logo: { type: LogoMetaSchema, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "tournaments", timestamps: true }
);

const TournamentModel = model<ITournament>("Tournament", tournamentSchema);

export default TournamentModel;
