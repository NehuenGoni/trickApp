import request from "supertest";
import mongoose from "mongoose";
import app from "../../app";
import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import League from "../../models/League";
import { createUserWithToken } from "../helpers/fixtures";

/**
 * Cubre el vector que `applyTournamentUpdate` (PUT /tournaments/:id) NO
 * protege: `attachTournament` (PUT /leagues/:id/tournaments/:tournamentId)
 * es un endpoint completamente aparte, del lado de la liga, y vincular ahí
 * un torneo con jugadores puede sumarlos de golpe a la liga.
 */
const grantActiveSubscription = async (userId: string, plan: "basico" | "club" | "pro" = "basico") =>
  User.updateOne(
    { _id: userId },
    {
      $set: {
        "billing.plan": plan,
        "billing.status": "active",
        "billing.currentPeriodEnd": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    }
  );

describe("PUT /leagues/:id/tournaments/:tournamentId (cupo de jugadores)", () => {
  it("rechaza vincular un torneo cuyos participantes exceden el cupo de la liga", async () => {
    const { userId: ownerId, token: ownerToken } = await createUserWithToken();
    await grantActiveSubscription(ownerId, "basico"); // maxMembers: 40
    const league = await League.create({ name: "Liga chica", startDate: new Date(), createdBy: ownerId });

    // Torneo suelto con 41 inscriptos (sin pasar por ningún handler de alta).
    const signupUsers = await Promise.all(Array.from({ length: 41 }, () => createUserWithToken()));
    const tournament = await TournamentModel.create({
      name: "Torneo grande",
      createdBy: ownerId,
      startDate: new Date(),
      status: "upcoming",
      league: null,
      individualSignups: signupUsers.map((u) => ({
        signupId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(u.userId),
        name: "x",
        isGuest: false
      }))
    });

    const res = await request(app)
      .put(`/leagues/${league._id}/tournaments/${tournament._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(402);
    expect(res.body.reason).toBe("league_member_limit_reached");
    expect(res.body.canUpgrade).toBe(true);

    const persisted = await TournamentModel.findById(tournament._id);
    expect(persisted!.league).toBeNull(); // no se vinculó
  });

  it("permite vincular un torneo cuyos participantes SÍ entran en el cupo", async () => {
    const { userId: ownerId, token: ownerToken } = await createUserWithToken();
    await grantActiveSubscription(ownerId, "basico"); // maxMembers: 40
    const league = await League.create({ name: "Liga con lugar", startDate: new Date(), createdBy: ownerId });

    const signupUsers = await Promise.all(Array.from({ length: 10 }, () => createUserWithToken()));
    const tournament = await TournamentModel.create({
      name: "Torneo chico",
      createdBy: ownerId,
      startDate: new Date(),
      status: "upcoming",
      league: null,
      individualSignups: signupUsers.map((u) => ({
        signupId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(u.userId),
        name: "x",
        isGuest: false
      }))
    });

    const res = await request(app)
      .put(`/leagues/${league._id}/tournaments/${tournament._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const persisted = await TournamentModel.findById(tournament._id);
    expect(persisted!.league?.toString()).toBe((league._id as mongoose.Types.ObjectId).toString());
  });

  it("plan Pro (sin tope): vincula un torneo grande sin problema", async () => {
    const { userId: ownerId, token: ownerToken } = await createUserWithToken();
    await grantActiveSubscription(ownerId, "pro");
    const league = await League.create({ name: "Liga Pro", startDate: new Date(), createdBy: ownerId });

    const signupUsers = await Promise.all(Array.from({ length: 60 }, () => createUserWithToken()));
    const tournament = await TournamentModel.create({
      name: "Torneo enorme",
      createdBy: ownerId,
      startDate: new Date(),
      status: "upcoming",
      league: null,
      individualSignups: signupUsers.map((u) => ({
        signupId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(u.userId),
        name: "x",
        isGuest: false
      }))
    });

    const res = await request(app)
      .put(`/leagues/${league._id}/tournaments/${tournament._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
  });
});
