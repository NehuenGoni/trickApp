import mongoose from "mongoose";
import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import {
  awardTournamentPoints,
  revertTournamentPoints
} from "../../controllers/tournament.controller";
import { createUserWithToken } from "../helpers/fixtures";

const makeTournament = async (playerStats: Array<{
  playerId?: mongoose.Types.ObjectId;
  name: string;
  isGuest: boolean;
  position: number;
  points: number;
}>) => {
  const { userId: creatorId } = await createUserWithToken();
  return TournamentModel.create({
    name: "Torneo award/revert",
    createdBy: creatorId,
    startDate: new Date(),
    playerStats,
    pointsAwarded: false
  });
};

describe("awardTournamentPoints / revertTournamentPoints", () => {
  it("suma exactamente los puntos de playerStats al ranking global", async () => {
    const p1 = await createUserWithToken();
    const p2 = await createUserWithToken();
    const tournament = await makeTournament([
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 },
      { playerId: new mongoose.Types.ObjectId(p2.userId), name: "p2", isGuest: false, position: 2, points: 18 }
    ]);

    await awardTournamentPoints(tournament);
    await tournament.save();

    expect(tournament.pointsAwarded).toBe(true);
    expect((await User.findById(p1.userId))!.totalPoints).toBe(25);
    expect((await User.findById(p2.userId))!.totalPoints).toBe(18);
  });

  it("otorgar dos veces seguidas es no-op (guard pointsAwarded)", async () => {
    const p1 = await createUserWithToken();
    const tournament = await makeTournament([
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 }
    ]);

    await awardTournamentPoints(tournament);
    await tournament.save();
    await awardTournamentPoints(tournament); // segunda vez: pointsAwarded ya es true
    await tournament.save();

    expect((await User.findById(p1.userId))!.totalPoints).toBe(25);
  });

  it("ignora invitados y entradas sin playerId", async () => {
    const tournament = await makeTournament([
      { name: "Invitado", isGuest: true, position: 1, points: 25 },
      { name: "Sin id", isGuest: false, position: 2, points: 18 }
    ]);

    await expect(awardTournamentPoints(tournament)).resolves.not.toThrow();
    expect(tournament.pointsAwarded).toBe(true);
  });

  it("ignora puntos en 0 (posición 8 de master-1000)", async () => {
    const p1 = await createUserWithToken();
    const before = (await User.findById(p1.userId))!.totalPoints;
    const tournament = await makeTournament([
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 8, points: 0 }
    ]);

    await awardTournamentPoints(tournament);
    expect((await User.findById(p1.userId))!.totalPoints).toBe(before);
  });

  it("revert es exactamente simétrico al award", async () => {
    const p1 = await createUserWithToken();
    const tournament = await makeTournament([
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 }
    ]);

    await awardTournamentPoints(tournament);
    await tournament.save();
    expect((await User.findById(p1.userId))!.totalPoints).toBe(25);

    await revertTournamentPoints(tournament);
    await tournament.save();
    expect(tournament.pointsAwarded).toBe(false);
    expect((await User.findById(p1.userId))!.totalPoints).toBe(0);
  });

  it("revertir sin haber otorgado es no-op (guard !pointsAwarded)", async () => {
    const p1 = await createUserWithToken();
    const tournament = await makeTournament([
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 }
    ]);

    await revertTournamentPoints(tournament); // nunca se otorgó
    expect((await User.findById(p1.userId))!.totalPoints).toBe(0);
  });

  it("revert clampea en 0 y nunca deja totalPoints negativo", async () => {
    const p1 = await createUserWithToken();
    // Otro torneo le restó puntos por fuera de este flujo (ajuste manual, p.ej.):
    // el usuario ya está en 10 cuando este torneo, que le había otorgado 25,
    // intenta revertir.
    await User.updateOne({ _id: p1.userId }, { $set: { totalPoints: 10 } });

    const tournament = await makeTournament([
      { playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 }
    ]);
    tournament.pointsAwarded = true; // simula que este torneo ya había otorgado
    await tournament.save();

    await revertTournamentPoints(tournament);
    await tournament.save();

    expect((await User.findById(p1.userId))!.totalPoints).toBe(0);
  });
});
