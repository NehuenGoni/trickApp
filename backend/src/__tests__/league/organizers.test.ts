import request from "supertest";
import app from "../../app";
import League from "../../models/League";
import TournamentModel from "../../models/Tournament";
import { ROLES } from "../../config/constants";
import { createUserWithToken } from "../helpers/fixtures";

/**
 * Hoy `canManageLeagues` solo deja crear ligas a admin/superadmin (abrirlo a
 * usuarios con suscripción activa es trabajo de la fase de billing, todavía
 * no implementada). Así que el "dueño" de una liga en este estado del
 * proyecto es necesariamente un admin — el caso que SÍ cambia con esta fase
 * es que el dueño pueda delegar la gestión de sus torneos a organizadores
 * que no son admins.
 */
const createLeagueOwner = () => createUserWithToken({ role: ROLES.ADMIN });

const makeLeague = async (ownerToken: string) => {
  const res = await request(app)
    .post("/leagues")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Liga del bar", startDate: new Date().toISOString() });
  return res.body;
};

describe("Organizadores de liga", () => {
  it("el dueño puede agregar y quitar organizadores", async () => {
    const owner = await createLeagueOwner();
    const other = await createUserWithToken();
    const league = await makeLeague(owner.token);

    const addRes = await request(app)
      .post(`/leagues/${league._id}/organizers`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: other.userId });
    expect(addRes.status).toBe(200);

    const afterAdd = await League.findById(league._id);
    expect(afterAdd!.organizers.map((o) => o.toString())).toContain(other.userId);

    const removeRes = await request(app)
      .delete(`/leagues/${league._id}/organizers/${other.userId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(removeRes.status).toBe(200);

    const afterRemove = await League.findById(league._id);
    expect(afterRemove!.organizers.map((o) => o.toString())).not.toContain(other.userId);
  });

  it("un usuario cualquiera no puede designar organizadores en una liga ajena", async () => {
    const owner = await createLeagueOwner();
    const intruder = await createUserWithToken();
    const target = await createUserWithToken();
    const league = await makeLeague(owner.token);

    const res = await request(app)
      .post(`/leagues/${league._id}/organizers`)
      .set("Authorization", `Bearer ${intruder.token}`)
      .send({ userId: target.userId });
    expect(res.status).toBe(403);
  });

  it("no permite agregar dos veces al mismo organizador", async () => {
    const owner = await createLeagueOwner();
    const other = await createUserWithToken();
    const league = await makeLeague(owner.token);

    await request(app)
      .post(`/leagues/${league._id}/organizers`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: other.userId });

    const secondAdd = await request(app)
      .post(`/leagues/${league._id}/organizers`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: other.userId });
    expect(secondAdd.status).toBe(409);
  });
});

describe("Un organizador designado gestiona un torneo que no creó", () => {
  it("puede editar, sortear e iniciar un torneo creado por el dueño de la liga", async () => {
    const owner = await createLeagueOwner();
    const organizer = await createUserWithToken();
    const league = await makeLeague(owner.token);

    await request(app)
      .post(`/leagues/${league._id}/organizers`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: organizer.userId });

    // El torneo lo crea el DUEÑO de la liga (no el organizador).
    const createRes = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Torneo del bar",
        startDate: new Date().toISOString(),
        type: "grand-slam",
        format: "duos",
        teamFormationMode: "user-formed",
        league: league._id
      });
    expect(createRes.status).toBe(201);
    const tournamentId = createRes.body._id as string;

    // El organizador (que NO es el creador ni el dueño) edita el torneo.
    const editRes = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ description: "Editado por el organizador" });
    expect(editRes.status).toBe(200);
    expect(editRes.body.description).toBe("Editado por el organizador");

    // Y también puede agregar equipos, sortear e iniciar.
    for (let i = 0; i < 8; i++) {
      const teamRes = await request(app)
        .post(`/tournaments/${tournamentId}/teams/guests`)
        .set("Authorization", `Bearer ${organizer.token}`)
        .send({
          name: `Equipo ${i + 1}`,
          members: [
            { name: `J${i}A`, isGuest: true },
            { name: `J${i}B`, isGuest: true }
          ]
        });
      expect(teamRes.status).toBe(201);
    }

    const drawRes = await request(app)
      .post(`/tournaments/${tournamentId}/draw`)
      .set("Authorization", `Bearer ${organizer.token}`);
    expect(drawRes.status).toBe(200);

    const startRes = await request(app)
      .post(`/tournaments/${tournamentId}/start`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ mode: "random" });
    expect(startRes.status).toBe(200);

    const tournament = await TournamentModel.findById(tournamentId);
    expect(tournament!.status).toBe("in_progress");
  });

  it("un usuario ajeno a la liga NO puede gestionar el torneo", async () => {
    const owner = await createLeagueOwner();
    const stranger = await createUserWithToken();
    const league = await makeLeague(owner.token);

    const createRes = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Torneo del bar",
        startDate: new Date().toISOString(),
        type: "grand-slam",
        format: "duos",
        teamFormationMode: "user-formed",
        league: league._id
      });
    const tournamentId = createRes.body._id as string;

    const editRes = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ description: "No debería poder" });
    expect(editRes.status).toBe(403);
  });

  it("quitar al organizador le revoca el acceso al torneo", async () => {
    const owner = await createLeagueOwner();
    const organizer = await createUserWithToken();
    const league = await makeLeague(owner.token);

    await request(app)
      .post(`/leagues/${league._id}/organizers`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: organizer.userId });

    const createRes = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Torneo del bar",
        startDate: new Date().toISOString(),
        type: "grand-slam",
        format: "duos",
        teamFormationMode: "user-formed",
        league: league._id
      });
    const tournamentId = createRes.body._id as string;

    await request(app)
      .delete(`/leagues/${league._id}/organizers/${organizer.userId}`)
      .set("Authorization", `Bearer ${owner.token}`);

    const editRes = await request(app)
      .put(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ description: "Ya no debería poder" });
    expect(editRes.status).toBe(403);
  });
});
