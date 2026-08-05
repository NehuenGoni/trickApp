import crypto from "crypto";
import request from "supertest";
import app from "../../app";
import Subscription from "../../models/Subscription";
import Payment from "../../models/Payment";
import { createUserWithToken } from "../helpers/fixtures";

// Credenciales de prueba: `isMercadoPagoEnabled()` las lee de `process.env`
// en cada llamada, así que alcanza con setearlas acá (no hace falta que
// existan antes del `import` de los módulos de billing).
process.env.MP_ACCESS_TOKEN = "test-access-token";
process.env.MP_WEBHOOK_SECRET = "test-webhook-secret";

const PREAPPROVAL_ID = "preapproval-1";
const EXPECTED_AMOUNT = 30000; // priceArsFor("club", "monthly", 1000 [default usdToArs]) = arsPrice(30, 1000)

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as Response;

/** Firma válida para el webhook, siguiendo exactamente el mismo manifest que `verifyWebhookSignature`. */
const signWebhook = (dataId: string, requestId = "req-1") => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET!).update(manifest).digest("hex");
  return { xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId };
};

let fetchCalls: Array<{ url: string; method: string; body: any }> = [];

beforeEach(() => {
  fetchCalls = [];
  global.fetch = jest.fn(async (url: any, init: any = {}) => {
    const u = String(url);
    const method = (init.method as string) ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    fetchCalls.push({ url: u, method, body });

    if (u.endsWith("/preapproval") && method === "POST") {
      return jsonResponse(201, {
        id: PREAPPROVAL_ID,
        status: "pending",
        init_point: `https://mp.test/checkout/${PREAPPROVAL_ID}`
      });
    }
    if (/\/preapproval\/[^/]+$/.test(u) && method === "PUT") {
      return jsonResponse(200, { id: u.split("/").pop(), status: body.status });
    }
    if (/\/preapproval\/[^/]+$/.test(u) && method === "GET") {
      return jsonResponse(200, { id: u.split("/").pop(), status: "authorized" });
    }
    if (/\/authorized_payments\/[^/]+$/.test(u) && method === "GET") {
      const id = u.split("/").pop()!;
      return jsonResponse(200, {
        id,
        status: "processed",
        preapproval_id: PREAPPROVAL_ID,
        transaction_amount: EXPECTED_AMOUNT,
        payment: { id: Number(id.replace(/\D/g, "")) || 1, status: "approved" }
      });
    }
    throw new Error(`fetch no mockeado: ${method} ${u}`);
  }) as any;
});

describe("POST /billing/checkout", () => {
  it("crea una suscripción pending y devuelve el init_point de MercadoPago", async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/billing/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "club", interval: "monthly" });

    expect(res.status).toBe(200);
    expect(res.body.initPoint).toBe(`https://mp.test/checkout/${PREAPPROVAL_ID}`);

    const subscription = await Subscription.findOne({ externalId: PREAPPROVAL_ID });
    expect(subscription).not.toBeNull();
    expect(subscription!.status).toBe("pending");
    expect(subscription!.paymentProvider).toBe("mercadopago");
    expect(subscription!.plan).toBe("club");
  });

  it("el monto lo calcula el servidor: un `amount` mandado por el cliente se ignora", async () => {
    const { token } = await createUserWithToken();

    await request(app)
      .post("/billing/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "club", interval: "monthly", amount: 1 });

    const createCall = fetchCalls.find((c) => c.url.endsWith("/preapproval") && c.method === "POST");
    expect(createCall).toBeDefined();
    expect(createCall!.body.auto_recurring.transaction_amount).toBe(EXPECTED_AMOUNT);
  });

  it("sin MercadoPago configurado, responde 409 con fallback manual", async () => {
    const { token } = await createUserWithToken();
    const savedToken = process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_ACCESS_TOKEN;

    try {
      const res = await request(app)
        .post("/billing/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ plan: "club", interval: "monthly" });

      expect(res.status).toBe(409);
      expect(res.body.fallback).toBe("manual");
    } finally {
      process.env.MP_ACCESS_TOKEN = savedToken;
    }
  });
});

describe("POST /billing/webhooks/mercadopago", () => {
  it("rechaza una firma inválida sin procesar nada", async () => {
    const { token } = await createUserWithToken();
    await request(app)
      .post("/billing/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "club", interval: "monthly" });

    const res = await request(app)
      .post("/billing/webhooks/mercadopago")
      .query({ type: "subscription_authorized_payment", "data.id": "ap-1" })
      .set("x-signature", "ts=123,v1=firmaInventada")
      .set("x-request-id", "req-1")
      .send({});

    expect(res.status).toBe(401);
    const payments = await Payment.find({ paymentProvider: "mercadopago" });
    expect(payments).toHaveLength(0);
  });

  it("un cobro aprobado activa el plan y GET /billing/me lo refleja", async () => {
    const { token } = await createUserWithToken();
    await request(app)
      .post("/billing/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "club", interval: "monthly" });

    const { xSignature, xRequestId } = signWebhook("ap-1");
    const webhookRes = await request(app)
      .post("/billing/webhooks/mercadopago")
      .query({ type: "subscription_authorized_payment", "data.id": "ap-1" })
      .set("x-signature", xSignature)
      .set("x-request-id", xRequestId)
      .send({});

    expect(webhookRes.status).toBe(200);

    const meRes = await request(app).get("/billing/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.body.plan).toBe("club");
    expect(meRes.body.isActive).toBe(true);
    expect(meRes.body.autoRenew).toBe(true);
    expect(meRes.body.paymentProvider).toBe("mercadopago");
    expect(new Date(meRes.body.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());
  });

  it("reentregar el mismo evento no acredita el período dos veces", async () => {
    const { token } = await createUserWithToken();
    await request(app)
      .post("/billing/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "club", interval: "monthly" });

    for (let i = 0; i < 2; i++) {
      const { xSignature, xRequestId } = signWebhook("ap-1");
      const res = await request(app)
        .post("/billing/webhooks/mercadopago")
        .query({ type: "subscription_authorized_payment", "data.id": "ap-1" })
        .set("x-signature", xSignature)
        .set("x-request-id", xRequestId)
        .send({});
      expect(res.status).toBe(200);
    }

    const payments = await Payment.find({ paymentProvider: "mercadopago", externalId: "ap-1" });
    expect(payments).toHaveLength(1);

    const historyRes = await request(app).get("/billing/history").set("Authorization", `Bearer ${token}`);
    expect(historyRes.body.payments).toHaveLength(1);
  });
});

describe("POST /billing/subscription/cancel", () => {
  it("corta la renovación automática sin perder el acceso vigente", async () => {
    const { token } = await createUserWithToken();
    await request(app)
      .post("/billing/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "club", interval: "monthly" });

    const { xSignature, xRequestId } = signWebhook("ap-1");
    await request(app)
      .post("/billing/webhooks/mercadopago")
      .query({ type: "subscription_authorized_payment", "data.id": "ap-1" })
      .set("x-signature", xSignature)
      .set("x-request-id", xRequestId)
      .send({});

    const cancelRes = await request(app)
      .post("/billing/subscription/cancel")
      .set("Authorization", `Bearer ${token}`);
    expect(cancelRes.status).toBe(200);

    const meRes = await request(app).get("/billing/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.body.isActive).toBe(true);
    expect(meRes.body.autoRenew).toBe(false);

    const subscription = await Subscription.findOne({ externalId: PREAPPROVAL_ID });
    expect(subscription!.canceledAt).not.toBeNull();
  });

  it("responde 404 si no hay suscripción de MercadoPago para cancelar", async () => {
    const { token } = await createUserWithToken();
    const res = await request(app)
      .post("/billing/subscription/cancel")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
