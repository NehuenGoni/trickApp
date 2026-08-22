import request from "supertest";
import app from "../../app";
import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import { ROLES } from "../../config/constants";
import { createUserWithToken, buildStartedTournament, playFullBracket } from "../helpers/fixtures";

/** Sube a un usuario ya creado a un plan pago con la suscripción vigente (canManageLeagues = true). */
const grantActiveSubscription = async (userId: string, plan: "basico" | "club" | "pro" = "basico") => {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "billing.plan": plan,
        "billing.status": "active",
        "billing.currentPeriodEnd": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    }
  );
};

const createTournament = (token: string, overrides: Record<string, unknown> = {}) =>
  request(app)
    .post("/tournaments")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Torneo de prueba",
      startDate: new Date().toISOString(),
      type: "grand-slam",
      format: "duos",
      teamFormationMode: "user-formed",
      ...overrides
    });

const makeLeague = (ownerToken: string, name = "Liga de prueba") =>
  request(app)
    .post("/leagues")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name, startDate: new Date().toISOString() });

describe("PUT /tournaments/:id", () => {
  it("el creador puede editar nombre y fecha, y persiste", async () => {
    const { token } = await createUserWithToken();
    const createRes = await createTournament(token);
    const tournamentId = createRes.body._id as string;
    const newDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Torneo renombrado", startDate: newDate });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Torneo renombrado");

    const persisted = await TournamentModel.findById(tournamentId);
    expect(persisted!.name).toBe("Torneo renombrado");
    expect(persisted!.startDate.toISOString()).toBe(newDate);
  });

  it("un usuario sin relación con el torneo no puede editarlo", async () => {
    const { token: creatorToken } = await createUserWithToken();
    const { token: strangerToken } = await createUserWithToken();
    const createRes = await createTournament(creatorToken);
    const tournamentId = createRes.body._id as string;

    const res = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ name: "No debería poder" });

    expect(res.status).toBe(403);
  });

  it("no se puede editar un torneo que ya está en curso", async () => {
    const fixture = await buildStartedTournament("grand-slam");

    const res = await request(app)
      .put(`/tournaments/${fixture.tournamentId}`)
      .set("Authorization", `Bearer ${fixture.creatorToken}`)
      .send({ name: "Ya arrancó" });

    expect(res.status).toBe(400);
  });

  it("no se puede cambiar el formato con equipos ya cargados", async () => {
    const { token } = await createUserWithToken();
    const createRes = await createTournament(token, { format: "duos" });
    const tournamentId = createRes.body._id as string;

    await request(app)
      .post(`/tournaments/${tournamentId}/teams/guests`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Equipo 1",
        members: [
          { name: "A", isGuest: true },
          { name: "B", isGuest: true }
        ]
      });

    const res = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ format: "trios" });

    expect(res.status).toBe(400);
    const persisted = await TournamentModel.findById(tournamentId);
    expect(persisted!.format).toBe("duos");
  });

  it("cambiar el type de un torneo con puntos ya otorgados recalcula sin duplicar", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    await playFullBracket(fixture); // dispara closeTournament: pointsAwarded = true

    const before = await TournamentModel.findById(fixture.tournamentId);
    expect(before!.pointsAwarded).toBe(true);
    const winnerId = before!.playerStats.find((s) => s.position === 1)!.playerId!;
    const pointsBeforeGrandSlam = (await User.findById(winnerId))!.totalPoints;
    expect(pointsBeforeGrandSlam).toBeGreaterThan(0);

    // El torneo público solo se puede editar mientras está "upcoming", así que
    // el cambio de type se ejerce vía el endpoint de admin (mismo helper compartido).
    const { token: adminToken } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    const res = await request(app)
      .put(`/admin/tournaments/${fixture.tournamentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ type: "master-1000" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/recalcularon/);

    // 1er puesto en grand-slam = 25 puntos; en master-1000 = 12. No deben sumarse ambos.
    const afterPoints = (await User.findById(winnerId))!.totalPoints;
    expect(afterPoints).toBe(pointsBeforeGrandSlam - 25 + 12);
  });

  it("un suscriptor sin relación con la liga no puede asignarle un torneo propio", async () => {
    const { token: ownerToken } = await createUserWithToken({ role: ROLES.ADMIN });
    const leagueRes = await makeLeague(ownerToken, "Liga ajena");
    const leagueId = leagueRes.body._id as string;

    const { userId: strangerId, token: strangerToken } = await createUserWithToken();
    await grantActiveSubscription(strangerId); // canManageLeagues() = true, pero no es dueño/organizador de esta liga

    const createRes = await createTournament(strangerToken);
    const tournamentId = createRes.body._id as string;

    const res = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ league: leagueId });

    expect(res.status).toBe(403);
    const persisted = await TournamentModel.findById(tournamentId);
    expect(persisted!.league).toBeNull();
  });

  it("el creador de un torneo en una liga ajena no puede desvincularlo", async () => {
    const { token: ownerToken } = await createUserWithToken({ role: ROLES.ADMIN });
    const leagueRes = await makeLeague(ownerToken, "Liga ajena 2");
    const leagueId = leagueRes.body._id as string;

    const { token: creatorToken } = await createUserWithToken();
    const createRes = await createTournament(creatorToken);
    const tournamentId = createRes.body._id as string;

    // El dueño de la liga es quien la vincula (attachTournament), no el creador del torneo.
    const attachRes = await request(app)
      .put(`/leagues/${leagueId}/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(attachRes.status).toBe(200);

    const res = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({ league: null });

    expect(res.status).toBe(403);
    const persisted = await TournamentModel.findById(tournamentId);
    expect(persisted!.league?.toString()).toBe(leagueId);
  });
});
