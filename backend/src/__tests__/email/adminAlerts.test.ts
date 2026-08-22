import mongoose from "mongoose";
import User from "../../models/User";
import { ROLES } from "../../config/constants";
import { adminAlertEmail } from "../../utils/adminEmailTemplates";
import { shouldAlert } from "../../utils/alertThrottle";

// `sendMail` y `setMailFailureHandler` mockeados: la segunda como jest.fn()
// para poder capturar (via `.mock.calls`) el handler que `adminAlerts.ts`
// registra al cargarse, y así invocarlo directamente en el test de
// anti-recursión sin depender de que `sendMail` real falle (imposible en
// `NODE_ENV=test`, ver el guard de `isMailConfigured()`).
jest.mock("../../utils/mailer", () => ({
  ...jest.requireActual("../../utils/mailer"),
  sendMail: jest.fn().mockResolvedValue(true),
  setMailFailureHandler: jest.fn()
}));

import { sendMail, setMailFailureHandler } from "../../utils/mailer";
import { notifyAdminPaymentApproved, notifyAdminPlanLimitHit, isAdminRecipient } from "../../services/adminAlerts";

const mockedSendMail = sendMail as jest.Mock;

// El registro del handler (`setMailFailureHandler(fn)` al final de
// `adminAlerts.ts`) pasa una única vez, como efecto de cargar el módulo —
// ANTES de que corra el primer test. Con `clearMocks: true` en la config de
// Jest, esa llamada se borra de `.mock.calls` en el primer `beforeEach`
// automático, así que hay que capturarla acá, a nivel de módulo, no dentro
// de un test.
const registeredFailureHandler = (setMailFailureHandler as jest.Mock).mock.calls.at(-1)?.[0] as
  | ((to: string, subject: string, error: unknown) => void)
  | undefined;

const createUser = async (overrides: Partial<{ username: string; email: string }> = {}) => {
  const suffix = new mongoose.Types.ObjectId().toString().slice(-6);
  const user = await User.create({
    username: overrides.username ?? `user-${suffix}`,
    email: overrides.email ?? `user-${suffix}@test.local`,
    password: "Password123!",
    role: ROLES.USER,
    emailVerified: true
  });
  return (user._id as mongoose.Types.ObjectId).toString();
};

describe("adminAlerts", () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;

  afterEach(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it("sin ADMIN_EMAIL configurada, no manda ninguna alerta", async () => {
    delete process.env.ADMIN_EMAIL;
    const userId = await createUser();

    await notifyAdminPlanLimitHit({
      userId,
      reason: "no_free_slot",
      plan: "free",
      usage: { periodKey: "2026-08", tournamentsCreated: 1, tournamentsTotal: 1 }
    });

    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("con una lista separada por comas, manda un mail a cada destinatario recortando espacios", async () => {
    process.env.ADMIN_EMAIL = " a@x.com ,b@x.com  ";
    const userId = await createUser();

    await notifyAdminPaymentApproved({
      userId,
      subscriptionId: new mongoose.Types.ObjectId().toString(),
      plan: "pro",
      interval: "monthly",
      amount: 50000,
      currency: "ARS",
      currentPeriodEnd: new Date()
    });

    const recipients = mockedSendMail.mock.calls.map(([payload]) => payload.to);
    expect(recipients).toEqual(["a@x.com", "b@x.com"]);
  });

  it("isAdminRecipient reconoce los destinatarios configurados, recortados", () => {
    process.env.ADMIN_EMAIL = " a@x.com ,b@x.com";
    expect(isAdminRecipient("a@x.com")).toBe(true);
    expect(isAdminRecipient("otro@x.com")).toBe(false);
  });
});

describe("shouldAlert", () => {
  it("deja pasar la primera vez y bloquea una segunda dentro de la misma ventana", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    expect(shouldAlert(key, 60_000)).toBe(true);
    expect(shouldAlert(key, 60_000)).toBe(false);
  });

  it("claves distintas no se pisan entre sí", () => {
    const base = `test:${Date.now()}:${Math.random()}`;
    expect(shouldAlert(`${base}:a`, 60_000)).toBe(true);
    expect(shouldAlert(`${base}:b`, 60_000)).toBe(true);
  });
});

describe("mailer failure handler (anti-recursión)", () => {
  it("ignora un fallo cuyo destinatario es justamente un admin, para no re-alertar en loop", () => {
    process.env.ADMIN_EMAIL = "admin@x.com";
    expect(typeof registeredFailureHandler).toBe("function");

    mockedSendMail.mockClear();
    registeredFailureHandler!("admin@x.com", "asunto cualquiera", new Error("boom"));

    // Nada disparado hacia sendMail como consecuencia directa de esta llamada:
    // el guard de `isAdminRecipient` corta antes de intentar alertar.
    expect(mockedSendMail).not.toHaveBeenCalled();
  });
});

describe("adminAlertEmail", () => {
  const HOSTILE = `<img src=x onerror=alert(1)>`;
  const ESCAPED_HOSTILE = "&lt;img src=x onerror=alert(1)&gt;";

  it("no deja datos hostiles crudos en el HTML si el caller los pasa ya escapados", () => {
    const mail = adminAlertEmail({
      eyebrow: "Pago",
      accent: "gold",
      title: "Nueva suscripción pagada",
      summaryText: `${HOSTILE} pagó.`,
      summaryHtml: `<strong>${ESCAPED_HOSTILE}</strong> pagó.`,
      rows: [{ label: "Usuario", value: ESCAPED_HOSTILE }]
    });

    expect(mail.html).toContain(ESCAPED_HOSTILE);
    expect(mail.html).not.toContain(HOSTILE);
    expect(mail.subject).toContain("[TrickApp]");
    expect(mail.html!.startsWith("<!DOCTYPE html>")).toBe(true);
  });
});
