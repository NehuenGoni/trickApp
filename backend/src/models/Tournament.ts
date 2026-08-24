import mongoose, { Schema, model, Document } from "mongoose";
import {
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  TEAM_FORMATION_MODES,
  GUEST_DRAW_MODES,
  TOURNAMENT_TEAMS_COUNT,
  MIN_TOURNAMENT_TEAMS,
  MAX_TOURNAMENT_TEAMS
} from "../config/constants";
import { PlanId, PLAN_IDS } from "../config/plans";

export type TournamentType = typeof TOURNAMENT_TYPES[keyof typeof TOURNAMENT_TYPES];
export type TournamentFormat = typeof TOURNAMENT_FORMATS[keyof typeof TOURNAMENT_FORMATS];
export type TeamFormationMode = typeof TEAM_FORMATION_MODES[keyof typeof TEAM_FORMATION_MODES];
export type GuestDrawMode = typeof GUEST_DRAW_MODES[keyof typeof GUEST_DRAW_MODES];

export interface IPlayer {
  playerId?: mongoose.Types.ObjectId;
  name: string;
  isGuest?: boolean;
  /**
   * Entrada de `individualSignups` de la que salió este jugador. Es lo que
   * permite saber con exactitud qué inscripto corresponde a qué jugador de un
   * equipo: los invitados no tienen `playerId` y pueden repetir nombre.
   * Opcional: los torneos ya sorteados antes de esta feature no lo tienen y se
   * resuelven por el fallback de `playerKey` (ver utils/roster.ts).
   */
  signupId?: mongoose.Types.ObjectId;
}

export interface ITeam {
  teamId: mongoose.Types.ObjectId;
  name: string;
  registeredBy?: mongoose.Types.ObjectId;
  players: IPlayer[];
  /**
   * El equipo deriva de `individualSignups`: sus jugadores ya están contados en
   * el pool y no se suman aparte al calcular cupos (ver `countFilledSlots`).
   * Lo marcan tanto el sorteo de `random` como el armado manual de
   * `creator-formed`. Los equipos cargados enteros a mano (`addGuestTeam`,
   * inscripción en `user-formed`) van sin el flag y sí ocupan cupo propio.
   */
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
  /**
   * Última vez que el creador reorganizó los equipos a mano (roster editor).
   * Sirve para avisar, antes de re-sortear en modo `random`, que esos cambios
   * se van a perder. Se limpia al sortear y al iniciar.
   */
  rosterEditedAt?: Date;
  matches: mongoose.Types.ObjectId[];
  playerStats: IPlayerStat[];
  pointsAwarded: boolean;
  /**
   * Cantidad de equipos del cuadro (mínimo `MIN_TOURNAMENT_TEAMS`, máximo
   * `MAX_TOURNAMENT_TEAMS`). Define junto con `format` cuántos jugadores
   * caben (`numberOfTeams * FORMAT_TEAM_SIZE[format]`) y el cuadro que arma
   * `utils/bracket.ts#buildBracket`. Los torneos creados antes de esta
   * feature no lo tenían: el default los deja en 8, el tamaño de siempre.
   */
  numberOfTeams: number;
  createdAt: Date;
  startDate: Date;
  description?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  logo?: ITournamentLogoMeta | null;
  /** Liga a la que pertenece, si la tiene. Un torneo pertenece a una sola liga. */
  league?: mongoose.Types.ObjectId | null;
  billing?: ITournamentBillingCharge | null;
}

/** Bajo qué plan y período se cobró este torneo (ver `services/billing.ts`). */
export interface ITournamentBillingCharge {
  plan: PlanId;
  /** 'YYYY-MM' del período en que se creó, para saber si borrar el torneo todavía puede devolver el cupo. */
  periodKey: string;
  chargedAt: Date;
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
  isGuest: { type: Boolean, default: false },
  signupId: { type: Schema.Types.ObjectId, required: false }
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
  position: { type: Number, required: true, min: 1, max: MAX_TOURNAMENT_TEAMS },
  points: { type: Number, required: true, min: 0 }
}, { _id: false });

const BillingChargeSchema = new Schema<ITournamentBillingCharge>({
  plan: { type: String, enum: PLAN_IDS, required: true },
  periodKey: { type: String, required: true },
  chargedAt: { type: Date, required: true }
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
    rosterEditedAt: { type: Date, default: undefined },
    startDate: { type: Date, required: true },
    description: { type: String },
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Match" }],
    playerStats: { type: [PlayerStatSchema], default: [] },
    pointsAwarded: { type: Boolean, default: false },
    numberOfTeams: {
      type: Number,
      required: true,
      min: MIN_TOURNAMENT_TEAMS,
      max: MAX_TOURNAMENT_TEAMS,
      default: TOURNAMENT_TEAMS_COUNT
    },
    status: {
      type: String,
      enum: ['upcoming', 'in_progress', 'completed'],
      default: 'upcoming'
    },
    // Los torneos creados antes de esta feature simplemente no tienen el campo:
    // se leen como `null` y el frontend cae al fallback de iniciales.
    logo: { type: LogoMetaSchema, default: null },
    // Opcional: la gran mayoría de los torneos no pertenece a ninguna liga.
    // Es la única fuente de verdad del vínculo torneo↔liga (ver models/League.ts).
    league: { type: Schema.Types.ObjectId, ref: "League", default: null },
    // Bajo qué plan y en qué período mensual se creó (ver services/billing.ts).
    // `null` en torneos legacy/de admin, que no pasaron por el gate de billing.
    // Sirve para devolver el cupo mensual si el torneo se borra dentro del
    // mismo período (`releaseTournamentSlot`) y para auditar sin reconstruir
    // el estado histórico del usuario.
    billing: { type: BillingChargeSchema, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "tournaments", timestamps: true }
);

// Es exactamente la query que arma la tabla de posiciones de una liga
// (computeLeagueStandings): todos los torneos completados de una liga.
tournamentSchema.index({ league: 1, status: 1 });
// Trayectoria en torneos de un jugador (utils/userStats): torneos completados
// donde participó. Multikey, igual que el índice análogo en Match.
tournamentSchema.index({ "playerStats.playerId": 1, status: 1 });

const TournamentModel = model<ITournament>("Tournament", tournamentSchema);

export default TournamentModel;
