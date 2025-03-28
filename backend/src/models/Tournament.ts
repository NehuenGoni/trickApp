import mongoose, { Schema, model, Document } from "mongoose";

export interface IPlayer {
  playerId?: mongoose.Types.ObjectId;
  name: string;
  isGuest?: boolean;
}

export interface ITeam {
  teamId: mongoose.Types.ObjectId;
  name: string;
  players: IPlayer[];
}

export interface ITournament extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId; 
  teams: ITeam[];
  numberOfTeams: number; 
  createdAt: Date;
  startDate: Date;
  description?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
}

const PlayerSchema = new Schema<IPlayer>({
  playerId: { type: Schema.Types.ObjectId, ref: "User", required: function() {
    return !this.isGuest;
  }},
  name: { type: String, required: true },
  isGuest: { type: Boolean, default: false }
});

const TeamSchema = new Schema<ITeam>({
  teamId: { type: Schema.Types.ObjectId, auto: true },
  name: { type: String, required: true },
  players: { type: [PlayerSchema], required: true },
});

const tournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teams: { type: [TeamSchema], required: true },
    startDate: { type: Date, required: true },
    description: { type: String },
    status: { 
      type: String, 
      enum: ['upcoming', 'in_progress', 'completed'],
      default: 'upcoming'
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "tournaments", timestamps: true }
);

const TournamentModel = model<ITournament>("Tournament", tournamentSchema);

export default TournamentModel;
