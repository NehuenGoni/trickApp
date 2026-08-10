import request from "supertest";
import app from "../../app";
import Subscription from "../../models/Subscription";
import { createUserWithToken } from "../helpers/fixtures";

process.env.MP_ACCESS_TOKEN = "test-access-token";
process.env.MP_WEBHOOK_SECRET = "test-webhook-secret";
process.env.CRON_SECRET = "test-cron-secret";

const PREAPPROVAL_ID = "preapproval-stale-1";

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as Response;

beforeEach(() => {
  global.fetch = jest.fn(async (url: any, init: any = {}) => {
    const u = String(url);
    const method = (init.method as string) ?? "GET";

    if (u.endsWith("/preapproval") && method === "POST") {
      return jsonResponse(201, { id: PREAPPROVAL_ID, status: "pending", init_point: "https://mp.test/checkout" });
    }
    if (u.endsWith(`/preapproval/${PREAPPROVAL_ID}`) && method === "GET") {
      return jsonResponse(200, { id: PREAPPROVAL_ID, status: "authorized" });
    }
    if (u.includes("/authorized_payments/search") && method === "GET") {
      return jsonResponse(200, {
        results: [
          {
            id: 999,
            status: "processed",
            preapproval_id: PREAPPROVAL_ID,
            transaction_amount: 30000,
            payment: { id: 999, status: "approved" },
            date_created: new Date().toISOString()
          }
        ]
      });
    }
    throw new Error(`fetch no mockeado: ${method} ${u}`);
  }) as any;
});

/**
 * Simula que la suscripción se creó hace `minutes` minutos, esquivando el
 * `immutable` de `createdAt`. Se usa `.collection` (driver nativo) para
 * saltarse la inmutabilidad que Mongoose aplica con `timestamps: true` — pero
 * eso también salta el cast automático de `_id`, por eso hay que pasar el
 * ObjectId ya instanciado en vez de su versión en string.
 */
const backdate = async (subscriptionId: unknown, minutes: number) => {
  await Subscription.collection.updateOne(
    { _id: subscriptionId as any },
    { $set: { createdAt: new Date(Date.now() - minutes * 60 * 1000) } }
  );
};

describe("POST /billing/cron/reconcile-pending", () => {
  it("sin el secreto correcto, responde 401 y no toca nada", async () => {
    const { token } = await createUserWithToken();
    await request(app).post("/billing/checkout").set("Authorization", `Bearer ${token}`).send({
      plan: "club",
      interval: "monthly"
    });
    const subscription = await Subscription.findOne({ externalId: PREAPPROVAL_ID });
    await backdate(subscription!._id, 10);

    const res = await request(app).post("/billing/cron/reconcile-pending").set("x-cron-secret", "cualquier-cosa");
    expect(res.status).toBe(401);

    const stillPending = await Subscription.findOne({ externalId: PREAPPROVAL_ID });
    expect(stillPending!.status).toBe("pending");
  });

  it("reconcilia una suscripción pending huérfana (pagada pero sin webhook ni vuelta del usuario)", async () => {
    const { token } = await createUserWithToken();
    await request(app).post("/billing/checkout").set("Authorization", `Bearer ${token}`).send({
      plan: "club",
      interval: "monthly"
    });
    const subscription = await Subscription.findOne({ externalId: PREAPPROVAL_ID });
    await backdate(subscription!._id, 10);

    const res = await request(app)
      .post("/billing/cron/reconcile-pending")
      .set("x-cron-secret", process.env.CRON_SECRET!);

    expect(res.status).toBe(200);
    expect(res.body.checked).toBe(1);

    const meRes = await request(app).get("/billing/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.body.plan).toBe("club");
    expect(meRes.body.isActive).toBe(true);
  });

  it("no toca una suscripción pending reciente (todavía puede estar en curso el checkout)", async () => {
    const { token } = await createUserWithToken();
    await request(app).post("/billing/checkout").set("Authorization", `Bearer ${token}`).send({
      plan: "club",
      interval: "monthly"
    });
    // Sin backdate: recién creada.

    const res = await request(app)
      .post("/billing/cron/reconcile-pending")
      .set("x-cron-secret", process.env.CRON_SECRET!);

    expect(res.status).toBe(200);
    expect(res.body.checked).toBe(0);

    const stillPending = await Subscription.findOne({ externalId: PREAPPROVAL_ID });
    expect(stillPending!.status).toBe("pending");
  });
});
