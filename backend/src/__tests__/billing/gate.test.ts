import request from "supertest";
import app from "../../app";
import User from "../../models/User";
import { ROLES } from "../../config/constants";
import { grantSubscriptionPeriod } from "../../services/billing";
import { createUserWithToken } from "../helpers/fixtures";

const createTournamentPayload = (overrides: Record<string, unknown> = {}) => ({
  name: "Torneo del bar",
  startDate: new Date().toISOString(),
  type: "grand-slam",
  format: "duos",
  teamFormationMode: "user-formed",
  ...overrides
});

describe("Gate de billing en POST /tournaments (end-to-end)", () => {
  it("un usuario nuevo crea su primer torneo gratis", async () => {
    const { token } = await createUserWithToken();
    const res = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send(createTournamentPayload());

    expect(res.status).toBe(201);
    expect(res.body.billing).toMatchObject({ plan: "free" });
  });

  it("el segundo torneo da 402 con el detalle del plan y el uso", async () => {
    const { token } = await createUserWithToken();
    await request(app).post("/tournaments").set("Authorization", `Bearer ${token}`).send(createTournamentPayload());

    const res = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send(createTournamentPayload({ name: "Segundo torneo" }));

    expect(res.status).toBe(402);
    expect(res.body.reason).toBe("no_free_slot");
    expect(res.body.plan).toBe("free");
    expect(typeof res.body.message).toBe("string");
  });

  it("EL MODELO DE NEGOCIO: borrar el torneo gratis y reintentar sigue dando 402", async () => {
    const { userId, token } = await createUserWithToken();
    const { token: adminToken } = await createUserWithToken({ role: ROLES.SUPERADMIN });

    const createRes = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send(createTournamentPayload());
    const tournamentId = createRes.body._id as string;

    const deleteRes = await request(app)
      .delete(`/tournaments/${tournamentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const retryRes = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send(createTournamentPayload({ name: "Reintento" }));
    expect(retryRes.status).toBe(402);

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsTotal).toBe(1);

    void adminToken; // silencia el lint de no-usado sin borrar la ayuda del fixture
  });

  it("con suscripción activa, respeta el límite mensual del plan y lo devuelve al borrar", async () => {
    const { userId, token } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "basico", interval: "monthly", months: 1, activatedBy: adminId });

    const first = await request(app).post("/tournaments").set("Authorization", `Bearer ${token}`).send(createTournamentPayload({ name: "T1" }));
    const second = await request(app).post("/tournaments").set("Authorization", `Bearer ${token}`).send(createTournamentPayload({ name: "T2" }));
    const third = await request(app).post("/tournaments").set("Authorization", `Bearer ${token}`).send(createTournamentPayload({ name: "T3" }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(402);
    expect(third.body.reason).toBe("monthly_limit_reached");

    // Borrar uno dentro del mismo mes devuelve el cupo (a diferencia del free).
    const deleteRes = await request(app)
      .delete(`/tournaments/${first.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const fourth = await request(app).post("/tournaments").set("Authorization", `Bearer ${token}`).send(createTournamentPayload({ name: "T4" }));
    expect(fourth.status).toBe(201);
  });

  it("sin suscripción, un plan pago sin activar da 402 con no_subscription", async () => {
    const { userId, token } = await createUserWithToken();
    // Le asignamos el plan 'basico' directo en la base, SIN pasar por
    // grantSubscriptionPeriod (billing.status queda 'none'), simulando a
    // alguien que quedó a mitad de un onboarding manual incompleto.
    await User.updateOne({ _id: userId }, { $set: { "billing.plan": "basico" } });

    const res = await request(app)
      .post("/tournaments")
      .set("Authorization", `Bearer ${token}`)
      .send(createTournamentPayload());
    expect(res.status).toBe(402);
    expect(res.body.reason).toBe("no_subscription");
  });

  it("un admin crea torneos sin ningún límite, sin billing", async () => {
    const { token } = await createUserWithToken({ role: ROLES.ADMIN });
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/tournaments")
        .set("Authorization", `Bearer ${token}`)
        .send(createTournamentPayload({ name: `Torneo admin ${i}` }));
      expect(res.status).toBe(201);
      expect(res.body.billing).toBeNull();
    }
  });
});

describe("Crear liga sin suscripción", () => {
  it("da 402, no 403 (para que el frontend distinga y lleve a /planes)", async () => {
    const { token } = await createUserWithToken();
    const res = await request(app)
      .post("/leagues")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Liga sin pagar", startDate: new Date().toISOString() });
    expect(res.status).toBe(402);
  });

  it("con suscripción activa, sí puede crear su liga", async () => {
    const { userId, token } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "basico", interval: "monthly", months: 1, activatedBy: adminId });

    const res = await request(app)
      .post("/leagues")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Liga del bar", startDate: new Date().toISOString() });
    expect(res.status).toBe(201);
  });

  it("respeta el tope de ligas del plan (Básico = 1)", async () => {
    const { userId, token } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "basico", interval: "monthly", months: 1, activatedBy: adminId });

    const first = await request(app)
      .post("/leagues")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Liga 1", startDate: new Date().toISOString() });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/leagues")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Liga 2", startDate: new Date().toISOString() });
    expect(second.status).toBe(400);
  });
});
