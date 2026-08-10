import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import { closeTournament } from "../../controllers/tournament.controller";
import { buildStartedTournament, playFullBracket } from "../helpers/fixtures";

describe("closeTournament", () => {
  it("es idempotente: cerrarlo de nuevo no duplica playerStats ni vuelve a otorgar puntos", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    await playFullBracket(fixture); // el último match dispara closeTournament automáticamente

    const afterFirstClose = await TournamentModel.findById(fixture.tournamentId);
    expect(afterFirstClose!.status).toBe("completed");
    expect(afterFirstClose!.pointsAwarded).toBe(true);
    expect(afterFirstClose!.playerStats).toHaveLength(16);

    const pointsSnapshot: Record<string, number> = {};
    for (const s of afterFirstClose!.playerStats) {
      pointsSnapshot[s.playerId!.toString()] = (await User.findById(s.playerId))!.totalPoints;
    }

    // Cerrarlo de nuevo a mano: pointsAwarded ya es true, así que closeTournament
    // debe salir por el guard sin tocar nada.
    await closeTournament(fixture.tournamentId);

    const afterSecondClose = await TournamentModel.findById(fixture.tournamentId);
    expect(afterSecondClose!.playerStats).toHaveLength(16);
    for (const [playerId, points] of Object.entries(pointsSnapshot)) {
      expect((await User.findById(playerId))!.totalPoints).toBe(points);
    }
  });

  it("sobre un torneo que no existe, no rompe", async () => {
    const fakeId = "000000000000000000000000";
    await expect(closeTournament(fakeId)).resolves.not.toThrow();
  });
});
