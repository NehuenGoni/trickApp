import User from "../../models/User";
import { PLANS, periodKeyOf } from "../../config/plans";
import {
  consumeTournamentSlot,
  releaseTournamentSlot,
  grantSubscriptionPeriod,
  changePlan,
  resolveBilling
} from "../../services/billing";
import { createUserWithToken } from "../helpers/fixtures";
import { ROLES } from "../../config/constants";

describe("consumeTournamentSlot — plan free", () => {
  it("el primer torneo se crea gratis", async () => {
    const { userId } = await createUserWithToken();
    const result = await consumeTournamentSlot(userId);
    expect(result.ok).toBe(true);

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsTotal).toBe(1);
  });

  it("el segundo torneo se rechaza (cupo de por vida agotado)", async () => {
    const { userId } = await createUserWithToken();
    await consumeTournamentSlot(userId);
    const second = await consumeTournamentSlot(userId);

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("no_free_slot");
  });

  it("EL CUPO GRATIS NO SE RECICLA: borrar el torneo y reintentar sigue dando rechazo", async () => {
    // Esta es la línea de código con más impacto económico de todo el plan de
    // negocio: si `tournamentsTotal` se decrementara acá, el producto sería
    // gratis para siempre para cualquiera que supiera borrar un torneo.
    const { userId } = await createUserWithToken();
    const first = await consumeTournamentSlot(userId);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Simula borrar el torneo dentro del mismo período: `releaseTournamentSlot`
    // solo toca `tournamentsCreated` (el contador mensual), nunca `tournamentsTotal`.
    await releaseTournamentSlot(userId, first.periodKey);

    const second = await consumeTournamentSlot(userId);
    expect(second.ok).toBe(false);

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsTotal).toBe(1); // nunca bajó de 1
  });

  it("dos creaciones concurrentes con el único cupo libre producen exactamente un éxito", async () => {
    const { userId } = await createUserWithToken();
    const [a, b] = await Promise.all([
      consumeTournamentSlot(userId),
      consumeTournamentSlot(userId)
    ]);
    const successes = [a, b].filter((r) => r.ok).length;
    expect(successes).toBe(1);

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsTotal).toBe(1);
  });
});

describe("consumeTournamentSlot — planes pagos", () => {
  it("sin suscripción activa, se rechaza con no_subscription", async () => {
    const { userId } = await createUserWithToken();
    await changePlan(userId, "basico"); // plan pago pero SIN período vigente (billing.status sigue 'none')

    const result = await consumeTournamentSlot(userId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_subscription");
  });

  it("con suscripción activa, consume hasta el límite mensual y después rechaza", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({
      userId,
      plan: "basico",
      interval: "monthly",
      months: 1,
      activatedBy: adminId
    });

    // Básico = 2 torneos por mes.
    const first = await consumeTournamentSlot(userId);
    const second = await consumeTournamentSlot(userId);
    const third = await consumeTournamentSlot(userId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toBe("monthly_limit_reached");

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsCreated).toBe(2);
    expect(user!.billing.usage.tournamentsTotal).toBe(2);
  });

  it("borrar un torneo del mes devuelve el cupo mensual (a diferencia del free)", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "basico", interval: "monthly", months: 1, activatedBy: adminId });

    const first = await consumeTournamentSlot(userId);
    await consumeTournamentSlot(userId);
    const third = await consumeTournamentSlot(userId);
    expect(third.ok).toBe(false); // ya usó los 2 del mes

    if (first.ok) await releaseTournamentSlot(userId, first.periodKey);

    const fourth = await consumeTournamentSlot(userId);
    expect(fourth.ok).toBe(true); // el cupo mensual SÍ se recuperó

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsCreated).toBe(2);
    // tournamentsTotal en cambio sigue subiendo con cada intento exitoso, nunca baja.
    expect(user!.billing.usage.tournamentsTotal).toBe(3);
  });

  it("el plan Pro no tiene tope mensual pero igual cuenta el uso", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "pro", interval: "monthly", months: 1, activatedBy: adminId });

    for (let i = 0; i < 10; i++) {
      const r = await consumeTournamentSlot(userId);
      expect(r.ok).toBe(true);
    }
    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsCreated).toBe(10);
  });

  it("suscripción vencida rechaza con no_subscription, no con monthly_limit_reached", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "club", interval: "monthly", months: 1, activatedBy: adminId });

    // Forzar el vencimiento a mano, como si hubiera pasado el mes sin renovar.
    await User.updateOne(
      { _id: userId },
      { $set: { "billing.currentPeriodEnd": new Date(Date.now() - 1000) } }
    );

    const result = await consumeTournamentSlot(userId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_subscription");
  });
});

describe("El reset mensual perezoso cruza el borde de mes correctamente", () => {
  it("si periodKey quedó de un mes anterior, el primer torneo del mes nuevo se crea y el contador arranca en 1", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "basico", interval: "monthly", months: 6, activatedBy: adminId });

    // Simula que el usuario ya había usado su cupo de un mes viejo.
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "billing.usage.periodKey": "2020-01",
          "billing.usage.tournamentsCreated": 2, // "agotado" en ese mes viejo
          "billing.usage.tournamentsTotal": 2
        }
      }
    );

    const result = await consumeTournamentSlot(userId);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.periodKey).toBe(periodKeyOf(new Date()));

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsCreated).toBe(1); // arrancó de nuevo, no acumuló sobre el mes viejo
    expect(user!.billing.usage.tournamentsTotal).toBe(3); // el histórico sí sigue sumando
  });
});

describe("resolveBilling", () => {
  it("free nunca está activo", () => {
    expect(resolveBilling({ plan: "free", status: "none", usage: { periodKey: "x", tournamentsCreated: 0, tournamentsTotal: 0 }, grandfathered: false }).isActive).toBe(false);
  });

  it("plan pago con currentPeriodEnd futuro está activo", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(
      resolveBilling({
        plan: "club",
        status: "active",
        currentPeriodEnd: future,
        usage: { periodKey: "x", tournamentsCreated: 0, tournamentsTotal: 0 },
        grandfathered: false
      }).isActive
    ).toBe(true);
  });

  it("plan pago con currentPeriodEnd pasado NO está activo aunque status diga 'active'", () => {
    const past = new Date(Date.now() - 1000);
    expect(
      resolveBilling({
        plan: "club",
        status: "active",
        currentPeriodEnd: past,
        usage: { periodKey: "x", tournamentsCreated: 0, tournamentsTotal: 0 },
        grandfathered: false
      }).isActive
    ).toBe(false);
  });
});

describe("grantSubscriptionPeriod", () => {
  it("extender una suscripción vigente apila el nuevo período después del vencimiento actual", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });

    const { subscription: first } = await grantSubscriptionPeriod({
      userId,
      plan: "basico",
      interval: "monthly",
      months: 1,
      activatedBy: adminId
    });

    const { subscription: second } = await grantSubscriptionPeriod({
      userId,
      plan: "basico",
      interval: "monthly",
      months: 1,
      activatedBy: adminId
    });

    // El segundo período arranca exactamente donde terminaba el primero, no "ahora".
    // `grantSubscriptionPeriod` siempre setea ambas fechas (nunca deja una
    // suscripción manual sin período), así que acá son seguras de afirmar.
    expect(second.currentPeriodStart!.getTime()).toBe(first.currentPeriodEnd!.getTime());

    const user = await User.findById(userId);
    expect(user!.billing.currentPeriodEnd!.getTime()).toBe(second.currentPeriodEnd!.getTime());
  });
});

describe("changePlan", () => {
  it("upgrade a mitad de período no resetea tournamentsCreated", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "basico", interval: "monthly", months: 1, activatedBy: adminId });

    await consumeTournamentSlot(userId);
    await consumeTournamentSlot(userId); // usó los 2 de Básico

    await changePlan(userId, "club");

    const user = await User.findById(userId);
    expect(user!.billing.usage.tournamentsCreated).toBe(2); // no se reseteó
    expect(user!.billing.plan).toBe("club");

    // Con Club (4/mes) ahora le quedan 2, no 4.
    const next = await consumeTournamentSlot(userId);
    expect(next.ok).toBe(true);
  });

  it("bajar a free cancela la suscripción y no recupera el torneo de prueba", async () => {
    const { userId } = await createUserWithToken();
    const { userId: adminId } = await createUserWithToken({ role: ROLES.SUPERADMIN });
    await grantSubscriptionPeriod({ userId, plan: "basico", interval: "monthly", months: 1, activatedBy: adminId });

    await changePlan(userId, "free");

    const user = await User.findById(userId);
    expect(user!.billing.plan).toBe("free");
    expect(user!.billing.status).toBe("canceled");
    expect(user!.billing.currentPeriodEnd).toBeNull();

    // tournamentsTotal es independiente del plan: si ya había consumido el
    // gratis antes de pagar, sigue sin poder crear otro gratis.
    await User.updateOne({ _id: userId }, { $set: { "billing.usage.tournamentsTotal": 1 } });
    const result = await consumeTournamentSlot(userId);
    expect(result.ok).toBe(false);
  });
});
