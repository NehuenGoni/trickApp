import mongoose, { Schema, Document } from "mongoose";
import { MATCH_TYPES, MATCH_STATUS } from "../config/constants";

interface IMatch extends Document {
  tournament: mongoose.Types.ObjectId | string;
  teams: {
    teamId: mongoose.Types.ObjectId;
    score: number;
  }[]; 
  winner?: mongoose.Types.ObjectId; 
  status: "in_progress" | "finished"; 
  type: "friendly" | "tournament";
  phase?: "group" | "quarter" | "semi" | "final";
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
        teamId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        score: { type: Number, default: 0 },
        players: [
          {
            playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            username: { type: String, required: false },
            isGuest: { type: Boolean, default: false }
          }
        ]
      }
    ],
    winner: { type: Schema.Types.ObjectId, ref: "User", required: false},
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
      enum: ["group", "quarter-finals", "semi-finals", "final"], 
      required: false 
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "matches", timestamps: true }
);

const Match = mongoose.model<IMatch>("Match", MatchSchema, "matches");

export default Match;
