import dotenv from "dotenv";
import mongoose from "mongoose";
import Tournament from "../models/Tournament";

dotenv.config();

/**
 * Backfill para torneos `upcoming` creados antes de que `individualSignups`
 * soportara invitados sueltos: agrega `signupId` (antes inexistente) e `isGuest`
 * (antes ausente, todos eran usuarios registrados) a cada inscripto, y `isDrawn`
 * a cada equipo. `auto: true` en el schema solo genera el id al crear un
 * subdocumento nuevo vía Mongoose, no rellena documentos ya persistidos.
 */
async function run() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.error("MONGO_URI no está definida en .env");
    process.exit(1);
  }

  await mongoose.connect(mongoURI);
  console.log("Conectado a MongoDB");

  const tournaments = await Tournament.find({}).lean();
  let tournamentsUpdated = 0;

  for (const t of tournaments) {
    const signups = (t.individualSignups ?? []) as Array<{
      signupId?: mongoose.Types.ObjectId;
      userId?: mongoose.Types.ObjectId;
      name: string;
      isGuest?: boolean;
    }>;
    const teams = (t.teams ?? []) as Array<{
      teamId: mongoose.Types.ObjectId;
      isDrawn?: boolean;
    }>;

    let signupsChanged = false;
    const newSignups = signups.map((s) => {
      if (s.signupId && s.isGuest !== undefined) return s;
      signupsChanged = true;
      return {
        ...s,
        signupId: s.signupId ?? new mongoose.Types.ObjectId(),
        isGuest: s.isGuest ?? false
      };
    });

    let teamsChanged = false;
    const newTeams = teams.map((team) => {
      if (team.isDrawn !== undefined) return team;
      teamsChanged = true;
      return { ...team, isDrawn: false };
    });

    if (!signupsChanged && !teamsChanged) continue;

    const update: Record<string, unknown> = {};
    if (signupsChanged) update.individualSignups = newSignups;
    if (teamsChanged) update.teams = newTeams;

    await Tournament.updateOne({ _id: t._id }, { $set: update });
    tournamentsUpdated++;
  }

  console.log(`Tournaments actualizados: ${tournamentsUpdated}`);

  await mongoose.disconnect();
  console.log("Migración completada");
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
