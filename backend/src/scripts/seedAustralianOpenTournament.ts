import dotenv from "dotenv";
import crypto from "crypto";
import mongoose from "mongoose";
import TournamentModel, { ITeam, IPlayer } from "../models/Tournament";
import MatchModel, { IMatchTeam } from "../models/Match";
import UserModel from "../models/User";
import { computePlayerStats, awardTournamentPoints } from "../controllers/tournament.controller";
import {
  MATCH_STATUS,
  MATCH_TYPES,
  MATCH_PHASES,
  BRACKET_SLOTS,
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS
} from "../config/constants";

dotenv.config();

/**
 * Carga el torneo histórico "Australian Open" (grupo Hood, jugado el
 * 20/02/2026 por fuera de la app) reconstruyendo a mano los 12 partidos del
 * bracket, igual que `repairWashingtonBracket.ts` pero creando el torneo de
 * cero (no reparando uno existente). Ver el plan
 * `tengo-los-datos-de-validated-octopus.md` para el detalle de cómo se
 * verificaron estos datos contra el Google Sheet original.
 *
 * No se asocia a ninguna liga (`league: null`): el dueño de la app va a
 * probar ese flujo aparte, desde la propia app.
 *
 * Benjamin Terzolo, Lucas Pereyra Iraola y Salvador Dell Acqua no tienen
 * cuenta existente: se les crea una cuenta nueva con email placeholder (a
 * corregir a mano después desde el panel superadmin) para que los puntos les
 * queden en el perfil. Luca Magnasco queda como invitado (`isGuest`).
 *
 * Dry-run por default; escribir requiere --apply. --confirm-db es
 * obligatorio y se verifica contra `mongoose.connection.name` antes de
 * escribir nada.
 *
 * Uso:
 *   npx ts-node src/scripts/seedAustralianOpenTournament.ts --confirm-db=testTrickApp
 *   npx ts-node src/scripts/seedAustralianOpenTournament.ts --confirm-db=testTrickApp --apply
 *   npx ts-node src/scripts/seedAustralianOpenTournament.ts --confirm-db=trickApp --apply
 */

const CREATED_BY = "692b6b85fb090e6d0781af1e";

type TeamKey = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8";

interface PlayerSpec {
  name: string;
  /** userId existente, o "NEW:<key>" para un usuario a crear, o undefined para invitado. */
  playerId?: mongoose.Types.ObjectId | `NEW:${string}`;
  isGuest?: boolean;
}

/** Usuarios sin cuenta existente que hay que crear para que les queden los puntos en el perfil. */
const NEW_USERS: Record<string, { name: string; email: string }> = {
  BENJAMIN: { name: "Benjamin Terzolo", email: "benjamin.terzolo@historico.trickapp" },
  LUCAS_PI: { name: "Lucas Pereyra Iraola", email: "lucas.pereyra.iraola@historico.trickapp" },
  SALVADOR: { name: "Salvador Dell Acqua", email: "salvador.dell.acqua@historico.trickapp" }
};

/** Mapping confirmado a mano contra la salida de findAustralianOpenPlayerMatches.ts. */
const TEAM_ROSTERS: Record<TeamKey, PlayerSpec[]> = {
  E1: [
    { name: "Tomas Yuste", playerId: new mongoose.Types.ObjectId("696152a7a87202e541990243") },
    { name: "Rafael Aguilar", playerId: new mongoose.Types.ObjectId("69614ce9a87202e5419901fb") },
    { name: "Benjamin Terzolo", playerId: "NEW:BENJAMIN" }
  ],
  E2: [
    { name: "Jose Bence Pieres", playerId: new mongoose.Types.ObjectId("69614fdfa87202e541990210") },
    { name: "Santiago Montenegro", playerId: new mongoose.Types.ObjectId("69614cbba87202e5419901f8") },
    { name: "Felipe Videla", playerId: new mongoose.Types.ObjectId("69615111a87202e54199022b") }
  ],
  E3: [
    { name: "Mateo Baldunciel", playerId: new mongoose.Types.ObjectId("696151f2a87202e541990234") },
    { name: "Nicolas Mancini", playerId: new mongoose.Types.ObjectId("69615238a87202e54199023a") },
    { name: "Ignacio Carrere", playerId: new mongoose.Types.ObjectId("69615005a87202e541990213") }
  ],
  E4: [
    { name: "Lucas Romanini", playerId: new mongoose.Types.ObjectId("69614d61a87202e541990204") },
    { name: "Fermin Arena", playerId: new mongoose.Types.ObjectId("696150cfa87202e541990225") },
    { name: "Ian Quelch", playerId: new mongoose.Types.ObjectId("69615161a87202e541990231") }
  ],
  E5: [
    { name: "Ezequiel Pires", playerId: new mongoose.Types.ObjectId("696150b2a87202e541990222") },
    { name: "Salvador Dell Acqua", playerId: "NEW:SALVADOR" },
    { name: "Tomas Plorutti", playerId: new mongoose.Types.ObjectId("69614befa87202e5419901f3") }
  ],
  E6: [
    { name: "Estanislao Harismendy", playerId: new mongoose.Types.ObjectId("69615098a87202e54199021f") },
    { name: "Facundo Caputo", playerId: new mongoose.Types.ObjectId("6962aaa8480b15a68a8d955e") },
    { name: "Matias Role", playerId: new mongoose.Types.ObjectId("69614d0da87202e5419901fe") }
  ],
  E7: [
    { name: "Luca Magnasco", isGuest: true },
    { name: "Tobias Aguilar", playerId: new mongoose.Types.ObjectId("6961526ca87202e541990240") },
    { name: "Lucas Pereyra Iraola", playerId: "NEW:LUCAS_PI" }
  ],
  E8: [
    { name: "Juan Cruz Tauber", playerId: new mongoose.Types.ObjectId("69614fb2a87202e54199020a") },
    { name: "Luciano Sabato", playerId: new mongoose.Types.ObjectId("69614d4aa87202e541990201") },
    { name: "Fermin Fernandez Llanos", playerId: new mongoose.Types.ObjectId("69615137a87202e54199022e") }
  ]
};

interface BracketEntry {
  bracketSlot: string;
  phase: string;
  teamA: TeamKey;
  scoreA: number;
  teamB: TeamKey;
  scoreB: number;
  winner: TeamKey;
}

/** Los 12 partidos, verificados contra la tabla de posiciones final del sheet. */
const BRACKET: BracketEntry[] = [
  { bracketSlot: BRACKET_SLOTS.QF1, phase: MATCH_PHASES.QUARTER_FINALS, teamA: "E1", scoreA: 29, teamB: "E6", scoreB: 30, winner: "E6" },
  { bracketSlot: BRACKET_SLOTS.QF2, phase: MATCH_PHASES.QUARTER_FINALS, teamA: "E2", scoreA: 27, teamB: "E7", scoreB: 30, winner: "E7" },
  { bracketSlot: BRACKET_SLOTS.QF3, phase: MATCH_PHASES.QUARTER_FINALS, teamA: "E3", scoreA: 17, teamB: "E8", scoreB: 30, winner: "E8" },
  { bracketSlot: BRACKET_SLOTS.QF4, phase: MATCH_PHASES.QUARTER_FINALS, teamA: "E4", scoreA: 30, teamB: "E5", scoreB: 18, winner: "E4" },
  { bracketSlot: BRACKET_SLOTS.SFG1, phase: MATCH_PHASES.SEMIFINALS_GOLD, teamA: "E6", scoreA: 27, teamB: "E7", scoreB: 30, winner: "E7" },
  { bracketSlot: BRACKET_SLOTS.SFG2, phase: MATCH_PHASES.SEMIFINALS_GOLD, teamA: "E8", scoreA: 30, teamB: "E4", scoreB: 28, winner: "E8" },
  { bracketSlot: BRACKET_SLOTS.SFS1, phase: MATCH_PHASES.SEMIFINALS, teamA: "E1", scoreA: 17, teamB: "E2", scoreB: 30, winner: "E2" },
  { bracketSlot: BRACKET_SLOTS.SFS2, phase: MATCH_PHASES.SEMIFINALS, teamA: "E3", scoreA: 19, teamB: "E5", scoreB: 30, winner: "E5" },
  { bracketSlot: BRACKET_SLOTS.FG, phase: MATCH_PHASES.FINAL_GOLD, teamA: "E7", scoreA: 30, teamB: "E8", scoreB: 12, winner: "E7" },
  { bracketSlot: BRACKET_SLOTS.M34, phase: MATCH_PHASES.THIRD_PLACE, teamA: "E6", scoreA: 30, teamB: "E4", scoreB: 27, winner: "E6" },
  { bracketSlot: BRACKET_SLOTS.FS, phase: MATCH_PHASES.FINAL, teamA: "E2", scoreA: 30, teamB: "E5", scoreB: 18, winner: "E2" },
  { bracketSlot: BRACKET_SLOTS.M78, phase: MATCH_PHASES.SEVENTH_PLACE, teamA: "E1", scoreA: 30, teamB: "E3", scoreB: 22, winner: "E1" }
];

const SLOT_ORDER = BRACKET.map((b) => b.bracketSlot);

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

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmDbArg = args.find((a) => a.startsWith("--confirm-db="));
  return { apply, confirmDb: confirmDbArg?.split("=")[1] };
}

async function run() {
  const { apply, confirmDb } = parseArgs();
  if (!confirmDb) {
    console.error("Falta --confirm-db=<nombre-de-base>.");
    process.exit(1);
  }

  const mongoURI = confirmDb === "trickApp" ? process.env.MONGO_URI_PROD : process.env.MONGO_URI;
  if (!mongoURI) {
    console.error(`Falta la variable de entorno de conexión para --confirm-db=${confirmDb}.`);
    process.exit(1);
  }

  await mongoose.connect(mongoURI);
  if (mongoose.connection.name !== confirmDb) {
    console.error(`La base conectada es "${mongoose.connection.name}", pero pediste --confirm-db=${confirmDb}. Abortando.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Conectado a: ${mongoose.connection.name}`);
  console.log(apply ? "MODO: APLICANDO CAMBIOS (--apply)" : "MODO: DRY-RUN (no se escribe nada; pasá --apply para aplicar)");

  try {
    // --- Guardas de existencia ---
    const creator = await UserModel.findById(CREATED_BY).select("username");
    if (!creator) throw new Error(`createdBy (${CREATED_BY}) no existe en "${mongoose.connection.name}". Abortando.`);

    const existingPlayerIds = Object.values(TEAM_ROSTERS)
      .flat()
      .filter((p): p is PlayerSpec & { playerId: mongoose.Types.ObjectId } => p.playerId instanceof mongoose.Types.ObjectId);
    const foundUsers = await UserModel.find({ _id: { $in: existingPlayerIds.map((p) => p.playerId) } }).select("username");
    const foundIds = new Set(foundUsers.map((u) => u._id.toString()));
    const missing = existingPlayerIds.filter((p) => !foundIds.has(p.playerId.toString()));
    if (missing.length > 0) {
      throw new Error(`playerId referenciados que no existen en "${mongoose.connection.name}": ${missing.map((m) => `${m.name}=${m.playerId}`).join(", ")}`);
    }

    for (const key of Object.keys(NEW_USERS)) {
      const email = NEW_USERS[key].email;
      const clash = await UserModel.findOne({ email }).select("_id");
      if (clash) throw new Error(`El email placeholder "${email}" ya está en uso por otro usuario (${clash._id}). Elegí otro.`);
    }

    // --- Resolver ids de los 2 usuarios nuevos ---
    const newUserIds: Record<string, mongoose.Types.ObjectId> = {};
    for (const key of Object.keys(NEW_USERS)) newUserIds[key] = new mongoose.Types.ObjectId();

    const resolvePlayerId = (p: PlayerSpec): mongoose.Types.ObjectId | undefined => {
      if (typeof p.playerId === "string") return newUserIds[p.playerId.replace("NEW:", "")];
      return p.playerId;
    };

    // --- Construcción de equipos ---
    const teamIds: Record<TeamKey, mongoose.Types.ObjectId> = {
      E1: new mongoose.Types.ObjectId(), E2: new mongoose.Types.ObjectId(),
      E3: new mongoose.Types.ObjectId(), E4: new mongoose.Types.ObjectId(),
      E5: new mongoose.Types.ObjectId(), E6: new mongoose.Types.ObjectId(),
      E7: new mongoose.Types.ObjectId(), E8: new mongoose.Types.ObjectId()
    };
    const teamNames: Record<TeamKey, string> = {
      E1: "Equipo 1", E2: "Equipo 2", E3: "Equipo 3", E4: "Equipo 4",
      E5: "Equipo 5", E6: "Equipo 6", E7: "Equipo 7", E8: "Equipo 8"
    };

    const teams: ITeam[] = (Object.keys(TEAM_ROSTERS) as TeamKey[]).map((key) => ({
      teamId: teamIds[key],
      name: teamNames[key],
      players: TEAM_ROSTERS[key].map((p): IPlayer => ({
        playerId: resolvePlayerId(p),
        name: p.name,
        isGuest: !!p.isGuest
      }))
    } as ITeam));

    const matchTeamFor = (key: TeamKey, score: number): IMatchTeam => ({
      teamId: teamIds[key],
      score,
      players: TEAM_ROSTERS[key].map((p) => ({
        playerId: resolvePlayerId(p),
        username: p.name,
        isGuest: !!p.isGuest
      }))
    } as IMatchTeam);

    // --- Construcción de los 12 partidos ---
    const matchIds: Record<string, mongoose.Types.ObjectId> = {};
    for (const slot of SLOT_ORDER) matchIds[slot] = new mongoose.Types.ObjectId();

    const feedsFor = (slot: string) => {
      const feeds = FEED_MAP[slot];
      if (!feeds) return {};
      const out: { feedsWinnerTo?: mongoose.Types.ObjectId; feedsLoserTo?: mongoose.Types.ObjectId } = {};
      if (feeds.winnerTo) out.feedsWinnerTo = matchIds[feeds.winnerTo];
      if (feeds.loserTo) out.feedsLoserTo = matchIds[feeds.loserTo];
      return out;
    };

    const tournamentId = new mongoose.Types.ObjectId();

    const matchDocs = BRACKET.map((b) => {
      const teamA = matchTeamFor(b.teamA, b.scoreA);
      const teamB = matchTeamFor(b.teamB, b.scoreB);
      const winnerId = teamIds[b.winner];
      const losingTeam = b.winner === b.teamA ? teamIds[b.teamB] : teamIds[b.teamA];
      return {
        _id: matchIds[b.bracketSlot],
        tournament: tournamentId,
        teams: [teamA, teamB],
        status: MATCH_STATUS.FINISHED,
        type: MATCH_TYPES.TOURNAMENT,
        phase: b.phase,
        bracketSlot: b.bracketSlot,
        winner: winnerId,
        losingTeam,
        ...feedsFor(b.bracketSlot)
      };
    });

    // --- Resumen (se imprime siempre) ---
    console.log("\nUsuarios nuevos a crear:");
    for (const key of Object.keys(NEW_USERS)) {
      console.log(`  ${NEW_USERS[key].name} — email placeholder: ${NEW_USERS[key].email} — id: ${newUserIds[key]}`);
    }

    console.log("\nLlave del torneo:");
    for (const b of BRACKET) {
      console.log(
        `  ${b.bracketSlot.padEnd(4)} ${b.phase.padEnd(15)} ${teamNames[b.teamA]} ${b.scoreA} - ${b.scoreB} ${teamNames[b.teamB]}  | winner: ${teamNames[b.winner]}`
      );
    }

    if (!apply) {
      console.log("\n[dry-run] Nada fue escrito. Pasá --apply para aplicar.");
      return;
    }

    // --- Escritura: usuarios nuevos ---
    for (const key of Object.keys(NEW_USERS)) {
      const password = crypto.randomBytes(24).toString("hex");
      const user = new UserModel({
        _id: newUserIds[key],
        username: NEW_USERS[key].name,
        email: NEW_USERS[key].email,
        password
      });
      await user.save();
      console.log(`Usuario creado: ${NEW_USERS[key].name} (${user._id})`);
    }

    // --- Escritura: torneo (upcoming, sin matches todavía) ---
    const tournament = new TournamentModel({
      _id: tournamentId,
      name: "Australian Open",
      createdBy: new mongoose.Types.ObjectId(CREATED_BY),
      type: TOURNAMENT_TYPES.GRAND_SLAM,
      format: TOURNAMENT_FORMATS.TRIOS,
      teams,
      startDate: new Date("2026-02-20"),
      matches: [],
      status: "upcoming",
      league: null
    });
    await tournament.save();
    console.log(`\nTorneo creado: ${tournament._id}`);

    // --- Escritura: partidos ---
    await MatchModel.insertMany(matchDocs);
    tournament.matches = SLOT_ORDER.map((slot) => matchIds[slot]);
    await tournament.save();
    console.log(`Partidos creados: ${matchDocs.length}`);

    // --- Cierre manual (misma lógica que closeTournament, sin el mail) ---
    tournament.playerStats = await computePlayerStats(tournament);
    tournament.status = "completed";
    await awardTournamentPoints(tournament);
    await tournament.save();

    console.log("\nplayerStats (posición, jugador, puntos):");
    for (const s of [...tournament.playerStats].sort((a, b) => a.position - b.position)) {
      console.log(`  ${s.position}. ${s.name}${s.isGuest ? " (invitado)" : ""} — ${s.points} pts`);
    }
    console.log(`\nTorneo cerrado. pointsAwarded=${tournament.pointsAwarded}. No se envió ningún mail de notificación.`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Error creando el torneo:", err);
  process.exit(1);
});
