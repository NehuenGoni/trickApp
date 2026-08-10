import mongoose from "mongoose";
import League from "../../models/League";
import TournamentModel from "../../models/Tournament";
import User from "../../models/User";
import { computeLeagueStandings } from "../../utils/leagueStandings";
import { createUserWithToken } from "../helpers/fixtures";

const makeLeague = async () => {
  const { userId } = await createUserWithToken();
  return League.create({ name: "Liga test", startDate: new Date(), createdBy: userId });
};

const completedTournament = (
  leagueId: mongoose.Types.ObjectId,
  playerStats: Array<{
    playerId?: mongoose.Types.ObjectId;
    name: string;
    isGuest: boolean;
    position: number;
    points: number;
  }>,
  overrides: Partial<{ status: string; startDate: Date }> = {}
) =>
  TournamentModel.create({
    name: "Torneo de liga",
    createdBy: new mongoose.Types.ObjectId(),
    startDate: overrides.startDate ?? new Date(),
    status: overrides.status ?? "completed",
    league: leagueId,
    playerStats
  });

describe("computeLeagueStandings", () => {
  it("solo cuenta torneos completados de esa liga", async () => {
    const league = await makeLeague();
    const otherLeague = await makeLeague();
    const p1 = await createUserWithToken();

    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 }
    ]);
    // Torneo "upcoming" de la misma liga: no debe contar.
    await completedTournament(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 999 }],
      { status: "upcoming" }
    );
    // Torneo completado de OTRA liga: no debe contar.
    await completedTournament(otherLeague._id as mongoose.Types.ObjectId, [
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 500 }
    ]);

    const result = await computeLeagueStandings(league._id as mongoose.Types.ObjectId);
    expect(result.tournamentsCounted).toBe(1);
    expect(result.standings).toHaveLength(1);
    expect(result.standings[0].points).toBe(25);
  });

  // NOTA: el comentario de leagueStandings.ts dice "dense ranking", pero el
  // código implementado es "standard competition ranking" (1-1-3): la
  // siguiente posición salta según el ÍNDICE del array, no según la cantidad
  // de grupos de puntaje distintos vistos. Este test caracteriza el
  // comportamiento REAL para no romperlo sin querer; si algún día se corrige
  // para que sea dense ranking de verdad (1-1-2), hay que actualizarlo.
  it("empate en puntos comparte posición (standard competition ranking, no dense)", async () => {
    const league = await makeLeague();
    const p1 = await createUserWithToken({ username: "p1" });
    const p2 = await createUserWithToken({ username: "p2" });
    const p3 = await createUserWithToken({ username: "p3" });

    // p1 y p2 empatan en 25, p3 tiene 10.
    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 },
      { playerId: new mongoose.Types.ObjectId(p2.userId), name: "p2", isGuest: false, position: 2, points: 25 },
      { playerId: new mongoose.Types.ObjectId(p3.userId), name: "p3", isGuest: false, position: 3, points: 10 }
    ]);

    const result = await computeLeagueStandings(league._id as mongoose.Types.ObjectId);
    const byName = new Map(result.standings.map((s) => [s.displayName, s]));

    expect(byName.get("p1")!.position).toBe(1);
    expect(byName.get("p2")!.position).toBe(1);
    // Standard competition ranking: el tercero salta a la posición 3 (por
    // índice), no a la 2 como sería en dense ranking real.
    expect(byName.get("p3")!.position).toBe(3);
  });

  it("agrupa invitados entre torneos por nombre normalizado (mayúsculas y acentos)", async () => {
    const league = await makeLeague();

    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { name: "José Pérez", isGuest: true, position: 1, points: 25 }
    ]);
    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { name: "JOSE PEREZ", isGuest: true, position: 2, points: 18 }
    ]);

    const result = await computeLeagueStandings(league._id as mongoose.Types.ObjectId);
    expect(result.standings).toHaveLength(1);
    expect(result.standings[0].points).toBe(43);
    expect(result.standings[0].tournamentsPlayed).toBe(2);
    expect(result.guestCount).toBe(1);
  });

  it("dos invitados con nombres distintos no se agrupan", async () => {
    const league = await makeLeague();
    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { name: "Juan", isGuest: true, position: 1, points: 25 },
      { name: "Juan P.", isGuest: true, position: 2, points: 18 }
    ]);

    const result = await computeLeagueStandings(league._id as mongoose.Types.ObjectId);
    expect(result.standings).toHaveLength(2);
  });

  it("usuario borrado: conserva el nombre de playerStats en vez de descartar sus puntos", async () => {
    const league = await makeLeague();
    const ghostId = new mongoose.Types.ObjectId(); // nunca existió en `users`

    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { playerId: ghostId, name: "Usuario Borrado", isGuest: false, position: 1, points: 25 }
    ]);

    const result = await computeLeagueStandings(league._id as mongoose.Types.ObjectId);
    expect(result.standings).toHaveLength(1);
    expect(result.standings[0].displayName).toBe("Usuario Borrado");
    expect(result.standings[0].userId).toBe(ghostId.toString());
  });

  it("usa el username ACTUAL del usuario, no el guardado en playerStats", async () => {
    const league = await makeLeague();
    const p1 = await createUserWithToken({ username: "nombre-viejo" });

    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "nombre-viejo", isGuest: false, position: 1, points: 25 }
    ]);
    await User.updateOne({ _id: p1.userId }, { $set: { username: "nombre-nuevo" } });

    const result = await computeLeagueStandings(league._id as mongoose.Types.ObjectId);
    expect(result.standings[0].displayName).toBe("nombre-nuevo");
  });

  it("cuenta victorias y podios correctamente", async () => {
    const league = await makeLeague();
    const p1 = await createUserWithToken();

    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 }
    ]);
    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 3, points: 15 }
    ]);
    await completedTournament(league._id as mongoose.Types.ObjectId, [
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 5, points: 8 }
    ]);

    const result = await computeLeagueStandings(league._id as mongoose.Types.ObjectId);
    const row = result.standings[0];
    expect(row.wins).toBe(1);
    expect(row.podiums).toBe(2); // posiciones 1 y 3
    expect(row.bestPosition).toBe(1);
    expect(row.tournamentsPlayed).toBe(3);
    expect(row.points).toBe(48);
  });
});
