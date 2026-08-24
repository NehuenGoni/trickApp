import request from "supertest";
import app from "../../app";
import { ROLES } from "../../config/constants";
import { createUserWithToken, createFinishedMatch } from "../helpers/fixtures";

describe("GET /users/:id/stats/summary", () => {
  it("401 sin token", async () => {
    const { userId } = await createUserWithToken();
    const res = await request(app).get(`/users/${userId}/stats/summary`);
    expect(res.status).toBe(401);
  });

  it("403 leyendo las estadísticas de otro usuario", async () => {
    const me = await createUserWithToken();
    const other = await createUserWithToken();

    const res = await request(app)
      .get(`/users/${other.userId}/stats/summary`)
      .set("Authorization", `Bearer ${me.token}`);

    expect(res.status).toBe(403);
  });

  it("200 para un admin leyendo las estadísticas de otro usuario", async () => {
    const admin = await createUserWithToken({ role: ROLES.ADMIN });
    const other = await createUserWithToken();

    const res = await request(app)
      .get(`/users/${other.userId}/stats/summary`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(other.userId);
  });

  it("200 con :id = 'me' resuelto al propio usuario", async () => {
    const me = await createUserWithToken();

    const res = await request(app)
      .get(`/users/me/stats/summary`)
      .set("Authorization", `Bearer ${me.token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(me.userId);
  });

  it("minPlayed fuera de rango se clampea en vez de romper", async () => {
    const me = await createUserWithToken();

    const res = await request(app)
      .get(`/users/me/stats/summary?minPlayed=9999`)
      .set("Authorization", `Bearer ${me.token}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.minPlayedTogether).toBe(20);
  });
});

describe("GET /users/:id/stats", () => {
  it("regresión del 404: usuario sin partidos devuelve 200 con lista vacía", async () => {
    const me = await createUserWithToken();

    const res = await request(app)
      .get(`/users/${me.userId}/stats`)
      .set("Authorization", `Bearer ${me.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matches: [], total: 0, skip: 0, limit: 10 });
  });

  it("paginación: conjuntos disjuntos y total constante", async () => {
    const me = await createUserWithToken();
    const rival = await createUserWithToken();
    for (let i = 0; i < 3; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: me.userId }],
        teamBPlayers: [{ playerId: rival.userId }],
        winner: "A",
        createdAt: new Date(Date.now() + i * 1000)
      });
    }

    const page1 = await request(app)
      .get(`/users/${me.userId}/stats?skip=0&limit=2`)
      .set("Authorization", `Bearer ${me.token}`);
    const page2 = await request(app)
      .get(`/users/${me.userId}/stats?skip=2&limit=2`)
      .set("Authorization", `Bearer ${me.token}`);

    expect(page1.body.total).toBe(3);
    expect(page2.body.total).toBe(3);
    expect(page1.body.matches).toHaveLength(2);
    expect(page2.body.matches).toHaveLength(1);
    const idsPage1 = page1.body.matches.map((m: any) => m._id);
    const idsPage2 = page2.body.matches.map((m: any) => m._id);
    expect(idsPage1.some((id: string) => idsPage2.includes(id))).toBe(false);
  });

  it(":id no-ObjectId devuelve 400", async () => {
    const me = await createUserWithToken();

    const res = await request(app)
      .get(`/users/no-es-un-id/stats`)
      .set("Authorization", `Bearer ${me.token}`);

    expect(res.status).toBe(400);
  });
});
