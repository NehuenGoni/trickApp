import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import app from "../../app";
import User, { UserRole } from "../../models/User";
import Match, { IMatch } from "../../models/Match";
import { ROLES } from "../../config/constants";

/**
 * Crea un usuario directo en Mongo (sin pasar por /auth/register) y su JWT.
 * `emailVerified: true` a propósito: estos fixtures no ejercitan el flujo de
 * verificación, y sin esto `requireVerifiedEmail` bloquearía con 403 casi
 * todo lo que crea un torneo o inicia un checkout en el resto de las suites.
 */
export const createUserWithToken = async (
  overrides: Partial<{ username: string; email: string; role: UserRole }> = {}
): Promise<{ userId: string; token: string }> => {
  const suffix = new mongoose.Types.ObjectId().toString().slice(-6);
  const user = await User.create({
    username: overrides.username ?? `user-${suffix}`,
    email: overrides.email ?? `user-${suffix}@test.local`,
    password: "Password123!",
    role: overrides.role ?? ROLES.USER,
    emailVerified: true
  });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: "60d" });
  return { userId: (user._id as mongoose.Types.ObjectId).toString(), token };
};

const authed = (token: string) => (req: request.Test) => req.set("Authorization", `Bearer ${token}`);

export interface FullTournamentResult {
  tournamentId: string;
  creatorToken: string;
  creatorId: string;
  /** bracketSlot -> matchId, para poder completar partidos por slot. */
  matchIdBySlot: Record<string, string>;
  /** Los 16 usuarios registrados que juegan (2 por equipo, equipos en orden). */
  playerIds: string[];
}

/**
 * Arma un torneo real de 8 equipos de principio a fin usando los endpoints
 * reales (create → addGuestTeam ×8 → draw → start), tal como lo haría un
 * usuario. Los jugadores son usuarios REGISTRADOS (no invitados) para poder
 * ejercitar `awardTournamentPoints`, que solo suma al ranking global a
 * jugadores con `playerId` y `isGuest: false`.
 *
 * Deja el bracket armado (12 partidos) sin jugar ningún partido todavía,
 * para que cada test decida qué resultados cargar.
 */
export const buildStartedTournament = async (
  type: "grand-slam" | "master-1000" = "grand-slam"
): Promise<FullTournamentResult> => {
  const { userId: creatorId, token: creatorToken } = await createUserWithToken();
  const auth = authed(creatorToken);

  const createRes = await auth(
    request(app).post("/tournaments").send({
      name: `Torneo test ${type}`,
      startDate: new Date().toISOString(),
      type,
      format: "duos",
      teamFormationMode: "user-formed"
    })
  );
  if (createRes.status !== 201) {
    throw new Error(`No se pudo crear el torneo: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  }
  const tournamentId = createRes.body._id as string;

  const playerIds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const playerA = await createUserWithToken({ username: `p${i}a` });
    const playerB = await createUserWithToken({ username: `p${i}b` });
    playerIds.push(playerA.userId, playerB.userId);

    const res = await auth(
      request(app)
        .post(`/tournaments/${tournamentId}/teams/guests`)
        .send({
          name: `Equipo ${i + 1}`,
          members: [
            { playerId: playerA.userId, name: `p${i}a`, isGuest: false },
            { playerId: playerB.userId, name: `p${i}b`, isGuest: false }
          ]
        })
    );
    if (res.status !== 201) {
      throw new Error(`No se pudo agregar el equipo ${i}: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }

  const drawRes = await auth(request(app).post(`/tournaments/${tournamentId}/draw`));
  if (drawRes.status !== 200) {
    throw new Error(`No se pudo sortear: ${drawRes.status} ${JSON.stringify(drawRes.body)}`);
  }

  const startRes = await auth(
    request(app).post(`/tournaments/${tournamentId}/start`).send({ mode: "random" })
  );
  if (startRes.status !== 200) {
    throw new Error(`No se pudo iniciar: ${startRes.status} ${JSON.stringify(startRes.body)}`);
  }

  const matchesRes = await request(app).get(`/matches/tournament/${tournamentId}`);
  const matchIdBySlot: Record<string, string> = {};
  for (const m of matchesRes.body as Array<{ _id: string; bracketSlot: string }>) {
    matchIdBySlot[m.bracketSlot] = m._id;
  }

  return { tournamentId, creatorToken, creatorId, matchIdBySlot, playerIds };
};

/** Finaliza un partido declarando ganador al primer equipo de `match.teams`. */
export const finishMatchAsFirstTeam = async (
  matchId: string,
  token: string
): Promise<{ status: number; body: any }> => {
  const getRes = await request(app).get(`/matches/${matchId}`);
  const winnerId = getRes.body.teams[0].teamId;
  const res = await request(app)
    .put(`/matches/${matchId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "finished", winner: winnerId });
  return { status: res.status, body: res.body };
};

/**
 * Juega el bracket completo en orden topológico (QF → SF → finales),
 * siempre haciendo ganar al primer equipo de cada partido. Devuelve el mismo
 * fixture para encadenar aserciones sobre el torneo ya cerrado.
 */
export const playFullBracket = async (fixture: FullTournamentResult): Promise<void> => {
  const order = ["QF1", "QF2", "QF3", "QF4", "SFG1", "SFG2", "SFS1", "SFS2", "FG", "FS", "M34", "M78"];
  for (const slot of order) {
    const matchId = fixture.matchIdBySlot[slot];
    const result = await finishMatchAsFirstTeam(matchId, fixture.creatorToken);
    if (result.status !== 200) {
      throw new Error(`No se pudo finalizar ${slot}: ${result.status} ${JSON.stringify(result.body)}`);
    }
  }
};

export interface FixturePlayer {
  playerId?: string;
  username?: string;
  isGuest?: boolean;
}

/**
 * Crea un `Match` directamente en Mongo (sin pasar por los endpoints), para
 * los tests de `utils/userStats.ts` que necesitan controlar `winner`,
 * `score` y `createdAt` con precisión. `winner` decide el equipo ganador por
 * su letra ('A' o 'B'); si se omite, el match queda sin winner (para probar
 * `discardedMatches`).
 */
export const createFinishedMatch = async (opts: {
  teamAPlayers: FixturePlayer[];
  teamBPlayers: FixturePlayer[];
  scoreA?: number;
  scoreB?: number;
  winner?: "A" | "B";
  status?: "finished" | "in_progress" | "pending";
  type?: "friendly" | "tournament";
  createdAt?: Date;
}): Promise<IMatch> => {
  const teamAId = new mongoose.Types.ObjectId();
  const teamBId = new mongoose.Types.ObjectId();

  const toMatchPlayers = (players: FixturePlayer[]) =>
    players.map((p) => ({
      playerId: p.playerId ? new mongoose.Types.ObjectId(p.playerId) : undefined,
      username: p.username ?? (p.playerId ? undefined : "Invitado"),
      isGuest: p.isGuest ?? !p.playerId
    }));

  const match = await Match.create({
    teams: [
      { teamId: teamAId, score: opts.scoreA ?? 0, players: toMatchPlayers(opts.teamAPlayers) },
      { teamId: teamBId, score: opts.scoreB ?? 0, players: toMatchPlayers(opts.teamBPlayers) }
    ],
    winner: opts.winner === "A" ? teamAId : opts.winner === "B" ? teamBId : undefined,
    status: opts.status ?? "finished",
    type: opts.type ?? "friendly",
    createdAt: opts.createdAt ?? new Date()
  });

  // createdAt tiene `default: Date.now` en el schema y `timestamps: true` lo
  // pisa al guardar; forzarlo con una segunda escritura si se pidió una fecha
  // específica (necesario para los tests de rachas/actividad).
  if (opts.createdAt) {
    await Match.updateOne({ _id: match._id }, { $set: { createdAt: opts.createdAt } });
    match.createdAt = opts.createdAt;
  }

  return match;
};
