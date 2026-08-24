import request from "supertest";
import app from "../../app";
import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import { pointsForPosition } from "../../utils/points";
import { matchCountFor } from "../../utils/bracket";
import { buildStartedTournament, playFullBracket, createUserWithToken } from "../helpers/fixtures";

/**
 * Cobertura end-to-end de la feature de tamaño variable: los mismos
 * endpoints reales que ya prueba `points/bracket.test.ts` para 8 equipos,
 * pero con cantidades que NO son potencia de 2 (el caso real que originó la
 * feature: 42 jugadores en tríos = 14 equipos) y con una potencia de 2 mayor
 * a 8, para separar "¿generaliza a otros tamaños parejos?" de "¿generaliza a
 * tamaños impares con descansos?".
 */

/** Crea `count` equipos de duos vía `addGuestTeam` en un torneo `user-formed` ya creado, sin sortear ni iniciar. */
const addGuestTeams = async (
  tournamentId: string,
  creatorToken: string,
  count: number
): Promise<string[]> => {
  const teamIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const p1 = await createUserWithToken({ username: `g${i}a-${tournamentId.slice(-4)}` });
    const p2 = await createUserWithToken({ username: `g${i}b-${tournamentId.slice(-4)}` });
    const res = await request(app)
      .post(`/tournaments/${tournamentId}/teams/guests`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        name: `Equipo ${i + 1}`,
        members: [
          { playerId: p1.userId, name: `g${i}a`, isGuest: false },
          { playerId: p2.userId, name: `g${i}b`, isGuest: false }
        ]
      });
    if (res.status !== 201) {
      throw new Error(`No se pudo agregar el equipo ${i}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    teamIds.push(res.body.team.teamId as string);
  }
  return teamIds;
};

describe("Torneos de tamaño variable — end-to-end", () => {
  it("14 equipos (42 jugadores en tríos, el caso real): arranca con la zona de oro perfecta y 2 descansos", async () => {
    const fixture = await buildStartedTournament("grand-slam", 14);

    const matchesRes = await request(app).get(`/matches/tournament/${fixture.tournamentId}`);
    const matches = matchesRes.body as Array<{
      status: string;
      teams: Array<{ teamId: string }>;
    }>;

    expect(matchCountFor(14)).toBe(25);
    expect(matches).toHaveLength(25);

    // 6 cruces reales de 1ra ronda + 1 cruce de puro descanso (los 2 equipos
    // que no entran en esos 6 cruces se enfrentan directo en la zona de oro):
    // 7 partidos arrancan jugables, el resto espera un resultado.
    const inProgress = matches.filter((m) => m.status === "in_progress");
    const pending = matches.filter((m) => m.status === "pending");
    expect(inProgress).toHaveLength(7);
    expect(pending).toHaveLength(18);

    // Los 14 equipos están cada uno en exactamente un partido ya jugable:
    // nadie descansa dos veces, nadie queda sin ubicar.
    const teamIdsInProgress = inProgress.flatMap((m) => m.teams.map((t) => t.teamId));
    expect(teamIdsInProgress).toHaveLength(14);
    expect(new Set(teamIdsInProgress).size).toBe(14);
  });

  it("14 equipos: cierra con puestos 1..14 exactos y puntos escalados ×1.40", async () => {
    const fixture = await buildStartedTournament("grand-slam", 14);
    await playFullBracket(fixture);

    const tournament = await TournamentModel.findById(fixture.tournamentId);
    expect(tournament!.status).toBe("completed");
    expect(tournament!.pointsAwarded).toBe(true);

    // 14 equipos × 2 jugadores (duos) = 28 entradas.
    expect(tournament!.playerStats).toHaveLength(28);

    const positions = tournament!.playerStats.map((s) => s.position).sort((a, b) => a - b);
    const expectedPositions = Array.from({ length: 14 }, (_, i) => i + 1).flatMap((p) => [p, p]);
    expect(positions).toEqual(expectedPositions);

    for (const stat of tournament!.playerStats) {
      expect(stat.points).toBe(pointsForPosition("grand-slam", stat.position, 14));
    }
    // El campeón de un torneo de 14 vale más que uno de 8 (25 × 1.40… ≈ 35.09, redondeado a 35).
    const championStat = tournament!.playerStats.find((s) => s.position === 1)!;
    expect(championStat.points).toBe(35);

    for (const stat of tournament!.playerStats) {
      const user = await User.findById(stat.playerId);
      expect(user!.totalPoints).toBe(stat.points);
    }
  });

  it("16 equipos (potencia de 2 > 8): cierra con puestos 1..16 exactos, sin descansos", async () => {
    const fixture = await buildStartedTournament("master-1000", 16);

    const matchesRes = await request(app).get(`/matches/tournament/${fixture.tournamentId}`);
    const matches = matchesRes.body as Array<{ status: string }>;
    expect(matchCountFor(16)).toBe(32);
    expect(matches).toHaveLength(32);
    // Potencia de 2: la 1ra ronda son 8 cruces reales, cero descansos.
    expect(matches.filter((m) => m.status === "in_progress")).toHaveLength(8);

    await playFullBracket(fixture);

    const tournament = await TournamentModel.findById(fixture.tournamentId);
    expect(tournament!.status).toBe("completed");
    expect(tournament!.playerStats).toHaveLength(32);

    const positions = tournament!.playerStats.map((s) => s.position).sort((a, b) => a - b);
    expect(positions).toEqual(Array.from({ length: 16 }, (_, i) => i + 1).flatMap((p) => [p, p]));

    const championStat = tournament!.playerStats.find((s) => s.position === 1)!;
    expect(championStat.points).toBe(18); // master-1000 campeón: 12 × 1.5
  });

  it("modo manual con descansos explícitos: arranca el mismo cuadro de 14 equipos", async () => {
    const { token: creatorToken } = await createUserWithToken();
    const createRes = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        name: "Manual 14",
        startDate: new Date().toISOString(),
        type: "grand-slam",
        format: "duos",
        teamFormationMode: "user-formed",
        numberOfTeams: 14
      });
    expect(createRes.status).toBe(201);
    const tournamentId = createRes.body._id as string;

    const teamIds = await addGuestTeams(tournamentId, creatorToken, 14);

    // 6 cruces (12 equipos) + 2 equipos que descansan = los 14 equipos.
    const pairings = Array.from({ length: 6 }, (_, i) => ({
      slot: `1-14#${i + 1}`,
      teamIds: [teamIds[i * 2], teamIds[i * 2 + 1]]
    }));
    const resting = [teamIds[12], teamIds[13]];

    const startRes = await request(app)
      .post(`/tournaments/${tournamentId}/start`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({ mode: "manual", pairings, resting });
    expect(startRes.status).toBe(200);

    const matchesRes = await request(app).get(`/matches/tournament/${tournamentId}`);
    const matches = matchesRes.body as Array<{ status: string; teams: Array<{ teamId: string }> }>;
    expect(matches).toHaveLength(25);
    expect(matches.filter((m) => m.status === "in_progress")).toHaveLength(7);
  });

  it("modo manual: rechaza si falta indicar quién descansa", async () => {
    const { token: creatorToken } = await createUserWithToken();
    const createRes = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        name: "Manual 14 sin resting",
        startDate: new Date().toISOString(),
        type: "grand-slam",
        format: "duos",
        teamFormationMode: "user-formed",
        numberOfTeams: 14
      });
    const tournamentId = createRes.body._id as string;
    const teamIds = await addGuestTeams(tournamentId, creatorToken, 14);

    const pairings = Array.from({ length: 6 }, (_, i) => ({
      slot: `1-14#${i + 1}`,
      teamIds: [teamIds[i * 2], teamIds[i * 2 + 1]]
    }));

    // Manda los 6 cruces pero omite `resting`: quedan 2 equipos sin ubicar.
    const res = await request(app)
      .post(`/tournaments/${tournamentId}/start`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({ mode: "manual", pairings });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/resting/i);
  });
});
