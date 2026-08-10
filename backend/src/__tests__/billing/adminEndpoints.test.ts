import request from "supertest";
import app from "../../app";
import { ROLES } from "../../config/constants";
import { createUserWithToken } from "../helpers/fixtures";

describe("GET /billing/me", () => {
  it("un usuario free ve su plan y su cupo de por vida sin consumir", async () => {
    const { token } = await createUserWithToken();
    const res = await request(app).get("/billing/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("free");
    expect(res.body.isActive).toBe(false);
    expect(res.body.usage.tournamentsTotal).toBe(0);
    expect(res.body.limits.tournamentsLifetime).toBe(1);
  });

  it("Infinity en los límites (plan Pro) se serializa como null, no se pierde", async () => {
    const { token, userId } = await createUserWithToken();
    const { token: superToken } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await request(app)
      .post(`/admin/users/${userId}/subscription`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ plan: "pro", interval: "monthly", months: 1 });

    const res = await request(app).get("/billing/me").set("Authorization", `Bearer ${token}`);
    expect(res.body.limits.tournamentsPerMonth).toBeNull();
    expect(res.body.limits.maxMembers).toBeNull();
  });

  it("rechaza sin token", async () => {
    const res = await request(app).get("/billing/me");
    expect(res.status).toBe(401);
  });
});

describe("Endpoints de admin de suscripciones", () => {
  it("un usuario normal no puede listar suscripciones", async () => {
    const { token } = await createUserWithToken();
    const res = await request(app).get("/admin/subscriptions").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("un admin (no superadmin) tampoco puede: es exclusivo de superadmin", async () => {
    const { token } = await createUserWithToken({ role: ROLES.ADMIN });
    const res = await request(app).get("/admin/subscriptions").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("superadmin activa una suscripción y aparece en el listado", async () => {
    const target = await createUserWithToken({ username: "bar-truco" });
    const superAdmin = await createUserWithToken({ role: ROLES.SUPERADMIN });

    const grantRes = await request(app)
      .post(`/admin/users/${target.userId}/subscription`)
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({ plan: "club", interval: "monthly", months: 3, amount: 30000 });

    expect(grantRes.status).toBe(200);
    expect(grantRes.body.subscription.plan).toBe("club");

    const listRes = await request(app)
      .get("/admin/subscriptions")
      .set("Authorization", `Bearer ${superAdmin.token}`);
    expect(listRes.status).toBe(200);
    const found = listRes.body.users.find((u: { _id: string }) => u._id === target.userId);
    expect(found).toBeDefined();
    expect(found.billing.plan).toBe("club");
    expect(found.isActive).toBe(true);
  });

  it("el historial de un usuario trae sus subscriptions y payments", async () => {
    const target = await createUserWithToken();
    const superAdmin = await createUserWithToken({ role: ROLES.SUPERADMIN });

    await request(app)
      .post(`/admin/users/${target.userId}/subscription`)
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({ plan: "basico", interval: "monthly", months: 1, amount: 8000 });

    const res = await request(app)
      .get(`/admin/users/${target.userId}/billing`)
      .set("Authorization", `Bearer ${superAdmin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscriptions).toHaveLength(1);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].amount).toBe(8000);
  });

  it("cambiar el plan a mano no resetea el uso ya consumido", async () => {
    const target = await createUserWithToken();
    const superAdmin = await createUserWithToken({ role: ROLES.SUPERADMIN });

    await request(app)
      .post(`/admin/users/${target.userId}/subscription`)
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({ plan: "basico", interval: "monthly", months: 1 });

    await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${target.token}`)
      .send({
        name: "T1",
        startDate: new Date().toISOString(),
        type: "grand-slam",
        format: "duos",
        teamFormationMode: "user-formed"
      });

    const changeRes = await request(app)
      .put(`/admin/users/${target.userId}/plan`)
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({ plan: "club" });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.billing.plan).toBe("club");
    expect(changeRes.body.billing.usage.tournamentsCreated).toBe(1);
  });

  it("acredita una suscripción anual sin `months`: deriva 12 meses del intervalo", async () => {
    const target = await createUserWithToken();
    const superAdmin = await createUserWithToken({ role: ROLES.SUPERADMIN });

    const grantRes = await request(app)
      .post(`/admin/users/${target.userId}/subscription`)
      .set("Authorization", `Bearer ${superAdmin.token}`)
      .send({ plan: "pro", interval: "yearly" });

    expect(grantRes.status).toBe(200);
    const periodStart = new Date(grantRes.body.subscription.currentPeriodStart);
    const periodEnd = new Date(grantRes.body.subscription.currentPeriodEnd);
    const expectedEnd = new Date(periodStart);
    expectedEnd.setUTCMonth(expectedEnd.getUTCMonth() + 12);
    expect(periodEnd.getTime()).toBe(expectedEnd.getTime());
  });
});

describe("GET /billing/pricing", () => {
  it("responde sin token: es público", async () => {
    const res = await request(app).get("/billing/pricing");
    expect(res.status).toBe(200);
    expect(typeof res.body.usdToArs).toBe("number");
    expect(res.body.usdToArs).toBeGreaterThan(0);
  });
});

describe("Endpoints de admin de precios", () => {
  it("un usuario normal no puede leer ni actualizar el tipo de cambio", async () => {
    const { token } = await createUserWithToken();
    const getRes = await request(app).get("/admin/pricing").set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(403);

    const putRes = await request(app)
      .put("/admin/pricing")
      .set("Authorization", `Bearer ${token}`)
      .send({ usdToArs: 1200 });
    expect(putRes.status).toBe(403);
  });

  it("un admin (no superadmin) tampoco puede: es exclusivo de superadmin", async () => {
    const { token } = await createUserWithToken({ role: ROLES.ADMIN });
    const res = await request(app).get("/admin/pricing").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("superadmin actualiza el tipo de cambio y se refleja en el endpoint público", async () => {
    const { token } = await createUserWithToken({ role: ROLES.SUPERADMIN });

    const putRes = await request(app)
      .put("/admin/pricing")
      .set("Authorization", `Bearer ${token}`)
      .send({ usdToArs: 1234 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.usdToArs).toBe(1234);

    const getRes = await request(app).get("/admin/pricing").set("Authorization", `Bearer ${token}`);
    expect(getRes.body.usdToArs).toBe(1234);

    const publicRes = await request(app).get("/billing/pricing");
    expect(publicRes.body.usdToArs).toBe(1234);
  });

  it("rechaza valores inválidos", async () => {
    const { token } = await createUserWithToken({ role: ROLES.SUPERADMIN });

    for (const usdToArs of [0, -100, "mil"]) {
      const res = await request(app)
        .put("/admin/pricing")
        .set("Authorization", `Bearer ${token}`)
        .send({ usdToArs });
      expect(res.status).toBe(400);
    }
  });
});
