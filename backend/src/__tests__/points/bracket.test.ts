import request from "supertest";
import app from "../../app";
import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import { POINTS_TABLE } from "../../config/constants";
import { buildStartedTournament, playFullBracket } from "../helpers/fixtures";

describe("Bracket completo de 8 equipos", () => {
  it.each(["grand-slam", "master-1000"] as const)(
    "cierra el torneo, calcula playerStats y otorga puntos exactos (%s)",
    async (type) => {
      const fixture = await buildStartedTournament(type);
      await playFullBracket(fixture);

      const tournament = await TournamentModel.findById(fixture.tournamentId);
      expect(tournament!.status).toBe("completed");
      expect(tournament!.pointsAwarded).toBe(true);

      // 8 equipos × 2 jugadores = 16 entradas, una por jugador.
      expect(tournament!.playerStats).toHaveLength(16);

      const points = POINTS_TABLE[type];
      const positions = tournament!.playerStats.map((s) => s.position).sort((a, b) => a - b);
      // Dos jugadores por posición, posiciones 1..8.
      expect(positions).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]);

      for (const stat of tournament!.playerStats) {
        expect(stat.points).toBe(points[stat.position as keyof typeof points]);
      }

      // El ranking global refleja exactamente lo que otorgó el torneo.
      for (const stat of tournament!.playerStats) {
        const user = await User.findById(stat.playerId);
        expect(user!.totalPoints).toBe(stat.points);
      }
    }
  );

  it("posición 8 en master-1000 vale 0 puntos y no rompe el award", async () => {
    const fixture = await buildStartedTournament("master-1000");
    await playFullBracket(fixture);

    const tournament = await TournamentModel.findById(fixture.tournamentId);
    const last = tournament!.playerStats.filter((s) => s.position === 8);
    expect(last).toHaveLength(2);
    for (const s of last) {
      expect(s.points).toBe(0);
      const user = await User.findById(s.playerId);
      expect(user!.totalPoints).toBe(0);
    }
  });

  it("no permite jugar un partido ya finalizado", async () => {
    const fixture = await buildStartedTournament();
    const matchId = fixture.matchIdBySlot.QF1;

    const getRes = await request(app).get(`/matches/${matchId}`);
    const winnerId = getRes.body.teams[0].teamId;

    const first = await request(app)
      .put(`/matches/${matchId}`)
      .set("Authorization", `Bearer ${fixture.creatorToken}`)
      .send({ status: "finished", winner: winnerId });
    expect(first.status).toBe(200);

    const second = await request(app)
      .put(`/matches/${matchId}`)
      .set("Authorization", `Bearer ${fixture.creatorToken}`)
      .send({ status: "finished", winner: winnerId });
    expect(second.status).toBe(409);
  });
});
