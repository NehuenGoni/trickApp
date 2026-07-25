import dotenv from "dotenv";
import mongoose from "mongoose";
import Match from "../models/Match";
import Tournament from "../models/Tournament";
import User from "../models/User";
import {
  MATCH_PHASES,
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  TEAM_FORMATION_MODES
} from "../config/constants";

dotenv.config();

const PHASE_MAP: Record<string, string> = {
  group: MATCH_PHASES.QUARTER_FINALS,
  quarter: MATCH_PHASES.QUARTER_FINALS,
  "quarter-finals": MATCH_PHASES.QUARTER_FINALS,
  semi: MATCH_PHASES.SEMIFINALS_GOLD,
  "semi-finals": MATCH_PHASES.SEMIFINALS_GOLD,
  "semifinals-gold": MATCH_PHASES.SEMIFINALS_GOLD,
  semifinals: MATCH_PHASES.SEMIFINALS,
  final: MATCH_PHASES.FINAL_GOLD,
  "final-gold": MATCH_PHASES.FINAL_GOLD
};

async function run() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.error("MONGO_URI no está definida en .env");
    process.exit(1);
  }

  await mongoose.connect(mongoURI);
  console.log("Conectado a MongoDB");

  let matchesUpdated = 0;
  const matches = await Match.find({}).lean();
  for (const m of matches) {
    const oldPhase = m.phase as string | undefined;
    if (!oldPhase) continue;
    const newPhase = PHASE_MAP[oldPhase];
    if (newPhase && newPhase !== oldPhase) {
      await Match.updateOne({ _id: m._id }, { $set: { phase: newPhase } });
      matchesUpdated++;
    }
  }
  console.log(`Matches actualizados con phase nuevo: ${matchesUpdated}`);

  const tournamentResult = await Tournament.updateMany(
    {
      $or: [
        { type: { $exists: false } },
        { format: { $exists: false } },
        { teamFormationMode: { $exists: false } },
        { individualSignups: { $exists: false } },
        { pointsAwarded: { $exists: false } },
        { playerStats: { $exists: false } }
      ]
    },
    {
      $setOnInsert: {},
      $set: {},
    }
  );
  // updateMany con $set vacío no aplica defaults, hago un loop manual
  const tournaments = await Tournament.find({}).lean();
  let tournamentsUpdated = 0;
  for (const t of tournaments) {
    const update: Record<string, unknown> = {};
    if (!(t as { type?: string }).type) update.type = TOURNAMENT_TYPES.MASTER_1000;
    if (!(t as { format?: string }).format) update.format = TOURNAMENT_FORMATS.DUOS;
    if (!(t as { teamFormationMode?: string }).teamFormationMode) {
      update.teamFormationMode = TEAM_FORMATION_MODES.USER_FORMED;
    }
    if (!(t as { individualSignups?: unknown[] }).individualSignups) update.individualSignups = [];
    if ((t as { pointsAwarded?: boolean }).pointsAwarded === undefined) update.pointsAwarded = false;
    if (!(t as { playerStats?: unknown[] }).playerStats) update.playerStats = [];
    if (Object.keys(update).length > 0) {
      await Tournament.updateOne({ _id: t._id }, { $set: update });
      tournamentsUpdated++;
    }
  }
  console.log(`Tournaments actualizados: ${tournamentsUpdated}`);
  console.log(`(updateMany pre-pass ack: ${tournamentResult.acknowledged})`);

  const usersResult = await User.updateMany(
    { totalPoints: { $exists: false } },
    { $set: { totalPoints: 0 } }
  );
  console.log(`Users actualizados con totalPoints: ${usersResult.modifiedCount}`);

  await mongoose.disconnect();
  console.log("Migración completada");
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
