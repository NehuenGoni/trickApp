import request from "supertest";
import app from "../../app";
import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import { ROLES } from "../../config/constants";
import { buildStartedTournament, playFullBracket, createUserWithToken } from "../helpers/fixtures";

/**
 * El ciclo revert → compute → award que dispara "Recalcular puntos" en el
 * panel admin debe ser NEUTRAL cuando no cambió nada en los partidos: es la
 * invariante que más fácil se rompe si se toca `awardTournamentPoints` /
 * `revertTournamentPoints` (p.ej. al agregarles un dual-write a otro lado).
 */
describe("Recalcular puntos (revert → compute → award)", () => {
  it("no cambia playerStats ni el ranking global si se ejecuta sobre un torneo sin modificar", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    await playFullBracket(fixture);

    const before = await TournamentModel.findById(fixture.tournamentId);
    const statsBefore = [...before!.playerStats]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ playerId: s.playerId?.toString(), position: s.position, points: s.points }));
    const pointsBefore: Record<string, number> = {};
    for (const s of before!.playerStats) {
      pointsBefore[s.playerId!.toString()] = (await User.findById(s.playerId))!.totalPoints;
    }

    const { token: adminToken } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    const res = await request(app)
      .post(`/admin/tournaments/${fixture.tournamentId}/recalculate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const after = await TournamentModel.findById(fixture.tournamentId);
    const statsAfter = [...after!.playerStats]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ playerId: s.playerId?.toString(), position: s.position, points: s.points }));

    expect(statsAfter).toEqual(statsBefore);
    expect(after!.pointsAwarded).toBe(true);

    for (const [playerId, points] of Object.entries(pointsBefore)) {
      expect((await User.findById(playerId))!.totalPoints).toBe(points);
    }
  });

  it("recalcular dos veces seguidas también es neutral (idempotencia del ciclo)", async () => {
    const fixture = await buildStartedTournament("master-1000");
    await playFullBracket(fixture);

    const { token: adminToken } = await createUserWithToken({ role: ROLES.SUPERADMIN });

    await request(app)
      .post(`/admin/tournaments/${fixture.tournamentId}/recalculate`)
      .set("Authorization", `Bearer ${adminToken}`);
    const once = await TournamentModel.findById(fixture.tournamentId);
    const statsOnce = [...once!.playerStats].sort((a, b) => a.position - b.position);

    await request(app)
      .post(`/admin/tournaments/${fixture.tournamentId}/recalculate`)
      .set("Authorization", `Bearer ${adminToken}`);
    const twice = await TournamentModel.findById(fixture.tournamentId);
    const statsTwice = [...twice!.playerStats].sort((a, b) => a.position - b.position);

    expect(statsTwice.map((s) => s.points)).toEqual(statsOnce.map((s) => s.points));
  });
});
