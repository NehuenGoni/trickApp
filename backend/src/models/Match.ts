import mongoose, { Schema, Document } from "mongoose";
import {
  MATCH_TYPES,
  MATCH_STATUS,
  MATCH_PHASES,
  BRACKET_SLOTS
} from "../config/constants";

export type MatchPhase = typeof MATCH_PHASES[keyof typeof MATCH_PHASES];
export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];
export type BracketSlot = typeof BRACKET_SLOTS[keyof typeof BRACKET_SLOTS];

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
    phase: {
      type: String,
      enum: Object.values(MATCH_PHASES),
      required: false
    },
    bracketSlot: {
      type: String,
      enum: Object.values(BRACKET_SLOTS),
      required: false
    },
    feedsWinnerTo: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: false },
    feedsLoserTo: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "matches", timestamps: true }
);

const Match = mongoose.model<IMatch>("Match", MatchSchema, "matches");

export default Match;
