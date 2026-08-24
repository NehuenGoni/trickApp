import request from "supertest";
import app from "../../app";
import { ROLES } from "../../config/constants";
import { createUserWithToken } from "../helpers/fixtures";

/**
 * `GET /leagues/mine` es el filtro server-side que reemplaza al filtro
 * client-side de `canManageLeague` en el selector de liga de
 * crear/editar torneo: mismo criterio (dueño, organizer, o admin ve todas),
 * pero resuelto en el servidor en vez de confiar en lo que manda el cliente.
 */
const createLeagueOwner = () => createUserWithToken({ role: ROLES.ADMIN });

const makeLeague = async (ownerToken: string, name: string) => {
  const res = await request(app)
    .post("/leagues")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name, startDate: new Date().toISOString() });
  return res.body;
};

describe("GET /leagues/mine", () => {
  it("requiere autenticación", async () => {
    const res = await request(app).get("/leagues/mine");
    expect(res.status).toBe(401);
  });

  it("el dueño ve su liga", async () => {
    const owner = await createLeagueOwner();
    await makeLeague(owner.token, "Liga del dueño");

    const res = await request(app).get("/leagues/mine").set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((l: any) => l.name)).toContain("Liga del dueño");
  });

  it("un organizer ve la liga aunque no la haya creado", async () => {
    const owner = await createLeagueOwner();
    const organizer = await createUserWithToken();
    const league = await makeLeague(owner.token, "Liga con organizer");

    await request(app)
      .post(`/leagues/${league._id}/organizers`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: organizer.userId });

    const res = await request(app)
      .get("/leagues/mine")
      .set("Authorization", `Bearer ${organizer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((l: any) => l._id)).toContain(league._id);
  });

  it("un usuario sin relación con la liga no la ve", async () => {
    const owner = await createLeagueOwner();
    const stranger = await createUserWithToken();
    const league = await makeLeague(owner.token, "Liga ajena");

    const res = await request(app).get("/leagues/mine").set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((l: any) => l._id)).not.toContain(league._id);
  });

  it("un admin ve todas las ligas, incluso las que no creó", async () => {
    const owner = await createLeagueOwner();
    const otherAdmin = await createUserWithToken({ role: ROLES.ADMIN });
    const league = await makeLeague(owner.token, "Liga de otro admin");

    const res = await request(app)
      .get("/leagues/mine")
      .set("Authorization", `Bearer ${otherAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((l: any) => l._id)).toContain(league._id);
  });
});
