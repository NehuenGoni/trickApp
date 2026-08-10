import dotenv from "dotenv";
import mongoose from "mongoose";
import TournamentModel from "../models/Tournament";
import { computePlayerStats, awardTournamentPoints } from "../controllers/tournament.controller";
import {
  MATCH_STATUS,
  MATCH_TYPES,
  BRACKET_SLOTS,
  MATCH_PHASES
} from "../config/constants";

dotenv.config();

/**
 * Reparación puntual, no reutilizable, del torneo "Master 1000 - Washington"
 * (`6962ad19506d794078cc5f5b`) en `testTrickApp`.
 *
 * Los 10 partidos de este torneo son documentos legacy: nunca tuvieron el
 * campo `tournament` ni `bracketSlot`, así que `getMatchesByTournament`
 * (Match.find({ tournament })) siempre devolvió []. Además, en `testTrickApp`
 * esos 10 documentos directamente no existen — solo sobreviven en `trickApp`
 * (prod), de donde este script los lee.
 *
 * Reconstruye la llave completa (agregando los 2 partidos por puesto que
 * nunca se jugaron), corrige los datos incorrectos detectados (winner de QF4,
 * winner faltante de SFG2, fase de la final de plata, format del torneo) y
 * cierra el torneo reusando `computePlayerStats`/`awardTournamentPoints` de
 * `tournament.controller.ts` — la misma lógica que usa el botón "Cerrar
 * torneo" del panel admin.
 *
 * Dry-run por default; escribir requiere --apply. --confirm-db es obligatorio
 * y debe ser exactamente "testTrickApp": este script solo tiene sentido ahí,
 * a diferencia de migrateProdToLatest.ts no acepta otra base.
 *
 * Uso:
 *   npx ts-node src/scripts/repairWashingtonBracket.ts --confirm-db=testTrickApp
 *   npx ts-node src/scripts/repairWashingtonBracket.ts --confirm-db=testTrickApp --apply
 */

const TOURNAMENT_ID = "6962ad19506d794078cc5f5b";

const TEAM_IDS = {
  E1: "6962ad1a506d794078cc5f5e",
  E2: "6962ad1b506d794078cc5f6e",
  E3: "6962ad1b506d794078cc5f83",
  E4: "6962ad1c506d794078cc5f9d",
  E5: "6962ad1c506d794078cc5fbc",
  E6: "6962ad1d506d794078cc5fe0",
  E7: "6962ad1e506d794078cc6009",
  E8: "6962ad1e506d794078cc6037"
} as const;
type TeamKey = keyof typeof TEAM_IDS;

const TEAM_NAMES: Record<TeamKey, string> = {
  E1: "Equipo 1",
  E2: "Equipo 2",
  E3: "Equipo 3",
  E4: "Equipo 4",
  E5: "Equipo 5",
  E6: "Equipo 6",
  E7: "Equipo 7",
  E8: "Equipo 8"
};

/**
 * Corrección por partido existente: a qué slot/fase corresponde cada _id
 * legacy, y el winner correcto cuando el dato original está mal o falta.
 * Derivado cruzando ganadores/perdedores contra FEED_MAP de
 * tournament.controller.ts — ver el plan para el detalle de la reconstrucción.
 */
const EXISTING_MATCH_FIXES: Record<
  string,
  { bracketSlot: string; phase: string; winnerOverride?: TeamKey }
> = {
  "6962ad1f506d794078cc606a": { bracketSlot: BRACKET_SLOTS.QF3, phase: MATCH_PHASES.QUARTER_FINALS },
  "6962ad20506d794078cc609e": { bracketSlot: BRACKET_SLOTS.QF1, phase: MATCH_PHASES.QUARTER_FINALS },
  "6962ad20506d794078cc60d2": { bracketSlot: BRACKET_SLOTS.QF2, phase: MATCH_PHASES.QUARTER_FINALS },
  "6962ad21506d794078cc6106": {
    bracketSlot: BRACKET_SLOTS.QF4,
    phase: MATCH_PHASES.QUARTER_FINALS,
    winnerOverride: "E8" // dato original tenía winner: Equipo 4, pero el resultado (16-30) lo gana Equipo 8
  },
  "6962d084910fde6ef645390a": { bracketSlot: BRACKET_SLOTS.SFG1, phase: MATCH_PHASES.SEMIFINALS_GOLD },
  "6962f586480b15a68a8d9833": {
    bracketSlot: BRACKET_SLOTS.SFG2,
    phase: MATCH_PHASES.SEMIFINALS_GOLD,
    winnerOverride: "E8" // dato original no tenía winner
  },
  "6962f688973c0c48a9efbd3c": { bracketSlot: BRACKET_SLOTS.SFS2, phase: MATCH_PHASES.SEMIFINALS },
  "6962f92c973c0c48a9efbe6c": { bracketSlot: BRACKET_SLOTS.SFS1, phase: MATCH_PHASES.SEMIFINALS },
  "696312099c0f95f423b84799": { bracketSlot: BRACKET_SLOTS.FG, phase: MATCH_PHASES.FINAL_GOLD },
  "696314619c0f95f423b847ea": { bracketSlot: BRACKET_SLOTS.FS, phase: MATCH_PHASES.FINAL } // dato original: 'final-gold', pero FS es la final de PLATA
};

/** Espejo de FEED_MAP en tournament.controller.ts. */
const FEED_MAP: Record<string, { winnerTo?: string; loserTo?: string }> = {
  [BRACKET_SLOTS.QF1]: { winnerTo: BRACKET_SLOTS.SFG1, loserTo: BRACKET_SLOTS.SFS1 },
  [BRACKET_SLOTS.QF2]: { winnerTo: BRACKET_SLOTS.SFG1, loserTo: BRACKET_SLOTS.SFS1 },
  [BRACKET_SLOTS.QF3]: { winnerTo: BRACKET_SLOTS.SFG2, loserTo: BRACKET_SLOTS.SFS2 },
  [BRACKET_SLOTS.QF4]: { winnerTo: BRACKET_SLOTS.SFG2, loserTo: BRACKET_SLOTS.SFS2 },
  [BRACKET_SLOTS.SFG1]: { winnerTo: BRACKET_SLOTS.FG, loserTo: BRACKET_SLOTS.M34 },
  [BRACKET_SLOTS.SFG2]: { winnerTo: BRACKET_SLOTS.FG, loserTo: BRACKET_SLOTS.M34 },
  [BRACKET_SLOTS.SFS1]: { winnerTo: BRACKET_SLOTS.FS, loserTo: BRACKET_SLOTS.M78 },
  [BRACKET_SLOTS.SFS2]: { winnerTo: BRACKET_SLOTS.FS, loserTo: BRACKET_SLOTS.M78 }
};

/** Orden canónico de slots, igual al de BRACKET_TEMPLATES en tournament.controller.ts. */
const SLOT_ORDER = [
  BRACKET_SLOTS.QF1,
  BRACKET_SLOTS.QF2,
  BRACKET_SLOTS.QF3,
  BRACKET_SLOTS.QF4,
  BRACKET_SLOTS.SFG1,
  BRACKET_SLOTS.SFG2,
  BRACKET_SLOTS.SFS1,
  BRACKET_SLOTS.SFS2,
  BRACKET_SLOTS.FG,
  BRACKET_SLOTS.FS,
  BRACKET_SLOTS.M34,
  BRACKET_SLOTS.M78
];

/** Los 2 partidos por puesto que nunca se jugaron, con el resultado que pasó el usuario. */
const NEW_MATCHES: Array<{
  bracketSlot: string;
  phase: string;
  teamA: TeamKey;
  scoreA: number;
  teamB: TeamKey;
  scoreB: number;
  winner?: TeamKey;
}> = [
  { bracketSlot: BRACKET_SLOTS.M34, phase: MATCH_PHASES.THIRD_PLACE, teamA: "E1", scoreA: 26, teamB: "E6", scoreB: 30, winner: "E6" },
  { bracketSlot: BRACKET_SLOTS.M78, phase: MATCH_PHASES.SEVENTH_PLACE, teamA: "E2", scoreA: 0, teamB: "E7", scoreB: 0 } // no se jugó ni se va a jugar: queda 0-0 sin ganador
];

interface RawMatchPlayer {
  playerId?: mongoose.Types.ObjectId;
  username?: string;
  isGuest?: boolean;
  _id?: mongoose.Types.ObjectId;
}
interface RawMatchTeam {
  teamId: mongoose.Types.ObjectId;
  score: number;
  players: RawMatchPlayer[];
  _id?: mongoose.Types.ObjectId;
}
interface RawMatch {
  _id: mongoose.Types.ObjectId;
  teams: RawMatchTeam[];
  winner?: mongoose.Types.ObjectId;
  losingTeam?: mongoose.Types.ObjectId;
  status: string;
  type: string;
  phase?: string;
  bracketSlot?: string;
  feedsWinnerTo?: mongoose.Types.ObjectId;
  feedsLoserTo?: mongoose.Types.ObjectId;
  tournament?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}
interface RawTeam {
  teamId: mongoose.Types.ObjectId;
  name: string;
  players: Array<{ playerId?: mongoose.Types.ObjectId; name: string; isGuest?: boolean }>;
}
interface RawTournament {
  _id: mongoose.Types.ObjectId;
  name: string;
  status: string;
  format: string;
  matches: mongoose.Types.ObjectId[];
  teams: RawTeam[];
  pointsAwarded?: boolean;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmDbArg = args.find((a) => a.startsWith("--confirm-db="));
  const confirmDb = confirmDbArg?.split("=")[1];
  return { apply, confirmDb };
}

async function run() {
  const { apply, confirmDb } = parseArgs();
  if (confirmDb !== "testTrickApp") {
    console.error(
      'Falta o es incorrecto --confirm-db=testTrickApp. Este script solo repara testTrickApp (lee de MONGO_URI_PROD sin escribirla nunca).'
    );
    process.exit(1);
  }

  const mongoURI = process.env.MONGO_URI;
  const mongoURIProd = process.env.MONGO_URI_PROD;
  if (!mongoURI || !mongoURIProd) {
    console.error("Faltan MONGO_URI y/o MONGO_URI_PROD en .env");
    process.exit(1);
  }

  await mongoose.connect(mongoURI);
  if (mongoose.connection.name !== confirmDb) {
    console.error(
      `La base conectada vía MONGO_URI es "${mongoose.connection.name}", no "${confirmDb}". Abortando sin tocar nada.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  const destDb = mongoose.connection.db!;
  console.log(`Conectado a destino: ${mongoose.connection.name}`);

  const prodConn = await mongoose.createConnection(mongoURIProd).asPromise();
  console.log(`Conectado a origen (solo lectura): ${prodConn.name}`);

  console.log(apply ? "MODO: APLICANDO CAMBIOS (--apply)" : "MODO: DRY-RUN (no se escribe nada; pasá --apply para aplicar)");

  try {
    const tournamentObjectId = new mongoose.Types.ObjectId(TOURNAMENT_ID);

    // --- Lectura ---
    const prodTournament = (await prodConn
      .collection("tournaments")
      .findOne({ _id: tournamentObjectId })) as unknown as RawTournament | null;
    const destTournament = (await destDb
      .collection("tournaments")
      .findOne({ _id: tournamentObjectId })) as unknown as RawTournament | null;

    if (!prodTournament) throw new Error("El torneo no existe en el origen (prod). Nada que reparar.");
    if (!destTournament) throw new Error("El torneo no existe en el destino (testTrickApp). Nada que reparar.");

    // --- Guardas ---
    const normalizeTeams = (t: RawTournament) =>
      JSON.stringify(
        [...t.teams]
          .map((tm) => [
            String(tm.teamId),
            tm.name,
            [...tm.players].map((p) => String(p.playerId ?? "")).sort()
          ])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      );
    if (normalizeTeams(prodTournament) !== normalizeTeams(destTournament)) {
      throw new Error("Los equipos del torneo difieren entre origen y destino. Abortando por seguridad.");
    }

    if (destTournament.status === "completed" && destTournament.pointsAwarded) {
      throw new Error(
        "El torneo ya está completed y pointsAwarded=true en destino. Ya fue reparado/cerrado; correr de nuevo duplicaría puntos. Usá recalculateTournamentPoints si hace falta corregirlo."
      );
    }

    const prodMatches = (await prodConn
      .collection("matches")
      .find({ _id: { $in: prodTournament.matches } })
      .toArray()) as unknown as RawMatch[];

    const knownIds = new Set(Object.keys(EXISTING_MATCH_FIXES));
    const prodIds = new Set(prodMatches.map((m) => String(m._id)));
    if (knownIds.size !== prodIds.size || [...knownIds].some((id) => !prodIds.has(id))) {
      throw new Error(
        "Los _id de los partidos en origen no coinciden con los que este script espera (EXISTING_MATCH_FIXES). Los datos cambiaron desde que se escribió el script — abortando."
      );
    }

    // Todos los playerId referenciados en los partidos deben existir en destino.
    const allPlayerIds = new Set<string>();
    for (const m of prodMatches) {
      for (const t of m.teams) {
        for (const p of t.players) {
          if (p.playerId) allPlayerIds.add(String(p.playerId));
        }
      }
    }
    const existingUsers = await destDb
      .collection("users")
      .find({ _id: { $in: [...allPlayerIds].map((id) => new mongoose.Types.ObjectId(id)) } })
      .project({ username: 1 })
      .toArray();
    const usersById = new Map(existingUsers.map((u) => [String(u._id), u.username as string]));
    const missingUsers = [...allPlayerIds].filter((id) => !usersById.has(id));
    if (missingUsers.length > 0) {
      throw new Error(`playerId referenciados en los partidos que no existen en destino: ${missingUsers.join(", ")}`);
    }

    // Mapa de nombres para backfillear `username`: primero el roster del torneo
    // (nombre tal como se inscribió), y de respaldo el username actual del user
    // (cubre jugadores prestados que jugaron un partido sin pertenecer a ningún
    // equipo del torneo — ver el plan, caso Mateo Baldunciel en SFS2).
    const nameById = new Map<string, string>();
    for (const t of destTournament.teams) {
      for (const p of t.players) {
        if (p.playerId) nameById.set(String(p.playerId), p.name);
      }
    }
    for (const [id, username] of usersById) {
      if (!nameById.has(id)) nameById.set(id, username);
    }

    // --- Construcción de los 12 partidos finales ---
    const newIds: Record<string, mongoose.Types.ObjectId> = {
      [BRACKET_SLOTS.M34]: new mongoose.Types.ObjectId(),
      [BRACKET_SLOTS.M78]: new mongoose.Types.ObjectId()
    };
    const slotToId = new Map<string, mongoose.Types.ObjectId>();
    for (const [id, fix] of Object.entries(EXISTING_MATCH_FIXES)) {
      slotToId.set(fix.bracketSlot, new mongoose.Types.ObjectId(id));
    }
    for (const [slot, id] of Object.entries(newIds)) slotToId.set(slot, id);

    const feedsFor = (slot: string) => {
      const feeds = FEED_MAP[slot];
      if (!feeds) return {};
      const out: { feedsWinnerTo?: mongoose.Types.ObjectId; feedsLoserTo?: mongoose.Types.ObjectId } = {};
      if (feeds.winnerTo) out.feedsWinnerTo = slotToId.get(feeds.winnerTo);
      if (feeds.loserTo) out.feedsLoserTo = slotToId.get(feeds.loserTo);
      return out;
    };

    const backfillUsernames = (teams: RawMatchTeam[]): RawMatchTeam[] =>
      teams.map((t) => ({
        ...t,
        players: t.players.map((p) => ({
          ...p,
          username: p.username || (p.playerId ? nameById.get(String(p.playerId)) : undefined) || p.username
        }))
      }));

    const finalMatches: RawMatch[] = [];

    for (const m of prodMatches) {
      const fix = EXISTING_MATCH_FIXES[String(m._id)];
      const winnerId = fix.winnerOverride ? new mongoose.Types.ObjectId(TEAM_IDS[fix.winnerOverride]) : m.winner;
      const losingTeam = winnerId
        ? m.teams.find((t) => String(t.teamId) !== String(winnerId))?.teamId
        : undefined;
      finalMatches.push({
        _id: m._id,
        tournament: tournamentObjectId,
        teams: backfillUsernames(m.teams),
        status: MATCH_STATUS.FINISHED,
        type: MATCH_TYPES.TOURNAMENT,
        phase: fix.phase,
        bracketSlot: fix.bracketSlot,
        winner: winnerId,
        losingTeam,
        ...feedsFor(fix.bracketSlot),
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        __v: m.__v ?? 0
      });
    }

    const teamById = new Map(destTournament.teams.map((t) => [String(t.teamId), t]));
    const buildTeamFromRoster = (key: TeamKey, score: number): RawMatchTeam => {
      const team = teamById.get(TEAM_IDS[key]);
      if (!team) throw new Error(`Equipo ${key} no encontrado en tournament.teams de destino`);
      return {
        teamId: new mongoose.Types.ObjectId(TEAM_IDS[key]),
        score,
        players: team.players.map((p) => ({
          playerId: p.playerId ? new mongoose.Types.ObjectId(String(p.playerId)) : undefined,
          username: p.name,
          isGuest: !!p.isGuest,
          _id: new mongoose.Types.ObjectId()
        })),
        _id: new mongoose.Types.ObjectId()
      };
    };

    for (const nm of NEW_MATCHES) {
      const teamA = buildTeamFromRoster(nm.teamA, nm.scoreA);
      const teamB = buildTeamFromRoster(nm.teamB, nm.scoreB);
      const winnerId = nm.winner ? new mongoose.Types.ObjectId(TEAM_IDS[nm.winner]) : undefined;
      const losingTeam = winnerId
        ? [teamA, teamB].find((t) => String(t.teamId) !== String(winnerId))?.teamId
        : undefined;
      finalMatches.push({
        _id: slotToId.get(nm.bracketSlot)!,
        tournament: tournamentObjectId,
        teams: [teamA, teamB],
        status: MATCH_STATUS.FINISHED,
        type: MATCH_TYPES.TOURNAMENT,
        phase: nm.phase,
        bracketSlot: nm.bracketSlot,
        winner: winnerId,
        losingTeam,
        ...feedsFor(nm.bracketSlot),
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      });
    }

    // --- Resumen (se imprime siempre, dry-run o apply) ---
    const teamName = (id?: mongoose.Types.ObjectId) => {
      if (!id) return "—";
      const entry = Object.entries(TEAM_IDS).find(([, v]) => v === String(id));
      return entry ? TEAM_NAMES[entry[0] as TeamKey] : String(id);
    };
    console.log(`\nTorneo: ${destTournament.name} (${TOURNAMENT_ID})`);
    console.log(`Partidos existentes a reescribir: ${prodMatches.length} | Partidos nuevos a crear: ${NEW_MATCHES.length}`);
    console.log("\nLlave reconstruida:");
    for (const slot of SLOT_ORDER) {
      const m = finalMatches.find((x) => x.bracketSlot === slot)!;
      const [a, b] = m.teams;
      console.log(
        `  ${slot.padEnd(4)} ${(m.phase || "").padEnd(15)} ${teamName(a.teamId)} ${a.score} - ${b.score} ${teamName(
          b.teamId
        )}  | winner: ${teamName(m.winner)}`
      );
    }
    console.log(`\ntournament.format: '${destTournament.format}' → 'trios'`);
    console.log(`tournament.status: '${destTournament.status}' → 'completed' (al cerrar)`);

    if (!apply) {
      console.log("\n[dry-run] Nada fue escrito. Pasá --apply para aplicar.");
      return;
    }

    // --- Escritura ---
    const bulkOps = finalMatches.map((m) => ({
      replaceOne: { filter: { _id: m._id }, replacement: m, upsert: true }
    }));
    const bulkResult = await destDb.collection("matches").bulkWrite(bulkOps);
    console.log(
      `\nmatches: upserted=${bulkResult.upsertedCount} modified=${bulkResult.modifiedCount} matched=${bulkResult.matchedCount}`
    );

    const orderedMatchIds = SLOT_ORDER.map((slot) => slotToId.get(slot)!);
    await destDb.collection("tournaments").updateOne(
      { _id: tournamentObjectId },
      { $set: { format: "trios", matches: orderedMatchIds } }
    );
    console.log("tournaments: format y matches actualizados");

    // --- Cierre del torneo, reusando la lógica del panel admin ---
    const tournament = await TournamentModel.findById(tournamentObjectId);
    if (!tournament) throw new Error("El torneo desapareció entre la escritura y el cierre (no debería pasar)");
    tournament.playerStats = await computePlayerStats(tournament);
    tournament.status = "completed";
    await awardTournamentPoints(tournament);
    await tournament.save();

    console.log("\nplayerStats (posición, jugador, puntos):");
    for (const s of [...tournament.playerStats].sort((a, b) => a.position - b.position)) {
      console.log(`  ${s.position}. ${s.name}${s.isGuest ? " (invitado)" : ""} — ${s.points} pts`);
    }
    console.log(`\nTorneo cerrado. pointsAwarded=${tournament.pointsAwarded}. Puntos sumados a totalPoints de cada usuario no invitado.`);
  } finally {
    await prodConn.close();
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Error en la reparación:", err);
  process.exit(1);
});
