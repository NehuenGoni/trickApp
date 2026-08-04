import User from "../../models/User";
import Match from "../../models/Match";
import TournamentModel from "../../models/Tournament";
import TournamentLogoModel from "../../models/TournamentLogo";
import { deleteTournamentCascade } from "../../controllers/tournament.controller";
import { buildStartedTournament, playFullBracket } from "../helpers/fixtures";

describe("deleteTournamentCascade", () => {
  it("borra los matches, el logo, revierte los puntos otorgados y borra el torneo", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    await playFullBracket(fixture);

    const tournament = await TournamentModel.findById(fixture.tournamentId);
    expect(tournament!.pointsAwarded).toBe(true);

    const winnerId = tournament!.playerStats.find((s) => s.position === 1)!.playerId!;
    expect((await User.findById(winnerId))!.totalPoints).toBeGreaterThan(0);

    await TournamentLogoModel.create({
      tournamentId: tournament!._id,
      data: Buffer.from("fake-image"),
      mimeType: "image/webp",
      size: 10,
      version: "v1"
    });

    const result = await deleteTournamentCascade(tournament!);

    expect(result.deletedMatches).toBe(12);
    expect(await Match.countDocuments({ tournament: tournament!._id })).toBe(0);
    expect(await TournamentLogoModel.findOne({ tournamentId: tournament!._id })).toBeNull();
    expect(await TournamentModel.findById(tournament!._id)).toBeNull();

    // Los puntos que este torneo había otorgado se revirtieron.
    expect((await User.findById(winnerId))!.totalPoints).toBe(0);
  });

  it("sobre un torneo que nunca otorgó puntos, no revierte nada (guard de revertTournamentPoints)", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    // No se juega ningún partido: el torneo sigue "upcoming", sin puntos otorgados.
    const tournament = await TournamentModel.findById(fixture.tournamentId);
    expect(tournament!.pointsAwarded).toBe(false);

    await expect(deleteTournamentCascade(tournament!)).resolves.toEqual({ deletedMatches: 12 });
    expect(await TournamentModel.findById(tournament!._id)).toBeNull();
  });
});
