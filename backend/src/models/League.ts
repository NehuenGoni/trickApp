import mongoose, { Schema, Document } from "mongoose";

interface IUserLeagueStats {
  userId: mongoose.Types.ObjectId;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  losses: number;
}

interface ILeague extends Document {
  name: string;
  description?: string;
  tournaments: mongoose.Types.ObjectId[];
  userStats: IUserLeagueStats[];
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserLeagueStatsSchema = new Schema<IUserLeagueStats>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  points: { type: Number, default: 0 },
  tournamentsPlayed: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 }
});

const LeagueSchema = new Schema<ILeague>(
  {
    name: { type: String, required: true },
    description: { type: String },
    tournaments: [{ type: Schema.Types.ObjectId, ref: "Tournament" }],
    userStats: [UserLeagueStatsSchema],
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Índices para mejorar el rendimiento de las consultas
LeagueSchema.index({ name: 1 });
LeagueSchema.index({ "userStats.userId": 1 });
LeagueSchema.index({ tournaments: 1 });

const League = mongoose.model<ILeague>("League", LeagueSchema);

export default League; 