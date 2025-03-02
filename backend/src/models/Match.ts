import mongoose, { Schema, Document } from "mongoose";

interface IMatch extends Document {
  tournament: mongoose.Types.ObjectId; // Torneo al que pertenece
  teams: {
    teamId: mongoose.Types.ObjectId;
    score: number;
  }[]; // Equipos y sus puntajes
  winner?: mongoose.Types.ObjectId; // Equipo ganador (opcional hasta que termine el partido)
  status: "in_progress" | "finished"; // Estado del partido
  createdAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    tournament: { type: Schema.Types.ObjectId, ref: "Tournament", required: true },
    teams: [
      {
        teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
        score: { type: Number, default: 0 },
      },
    ],
    winner: { type: Schema.Types.ObjectId, ref: "Team", required: false},
    status: { type: String, enum: ["in_progress", "finished"], default: "in_progress" },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "matches", timestamps: true }
);

const Match = mongoose.model<IMatch>("Match", MatchSchema, "matches");

export default Match;
