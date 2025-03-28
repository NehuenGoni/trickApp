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
  createdAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    tournament: { 
      type: Schema.Types.Mixed, 
      required: true,
      refPath: 'type'
    },
    teams: [
      {
        teamId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        score: { type: Number, default: 0 },
      },
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
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "matches", timestamps: true }
);

const Match = mongoose.model<IMatch>("Match", MatchSchema, "matches");

export default Match;
