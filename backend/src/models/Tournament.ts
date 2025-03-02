import mongoose, { Schema, model, Document } from "mongoose";

  export interface IPlayer {
    playerId: mongoose.Types.ObjectId;
    name: string;
  }
  
  export interface ITeam {
    teamId: mongoose.Types.ObjectId;
    players: IPlayer[];
  }
  
  export interface ITournament extends Document {
    name: string;
    createdBy: mongoose.Types.ObjectId; 
    teams: ITeam[];
    numberOfTeams: number; 
    createdAt: Date;
  }
  
  const PlayerSchema = new Schema<IPlayer>({
    playerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
  });
  
  const TeamSchema = new Schema<ITeam>({
    teamId: { type: Schema.Types.ObjectId, auto: true },
    players: { type: [PlayerSchema], required: true },
  });
  
  const tournamentSchema = new Schema<ITournament>(
    {
      name: { type: String, required: true },
      createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      teams: { type: [TeamSchema], required: true }, // Ahora usa `TeamSchema`
      //numberOfTeams: { type: Number, required: true },
      createdAt: { type: Date, default: Date.now }, 
    },
    { collection: "tournaments", timestamps: true }
  )

const TournamentModel = model<ITournament>("Tournament", tournamentSchema);

export default TournamentModel;
