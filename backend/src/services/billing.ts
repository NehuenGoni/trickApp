import { ClientSession } from "mongoose";
import User, { IBilling } from "../models/User";
import Subscription, { ISubscription, SubscriptionInterval } from "../models/Subscription";
import Payment, { IPayment } from "../models/Payment";
import { PLANS, PlanId, periodKeyOf } from "../config/plans";
import { withTransaction } from "../utils/withTransaction";

export interface EffectiveBilling {
  plan: PlanId;
  /** true si el plan es de pago Y la suscripción está vigente ahora mismo. */
  isActive: boolean;
}

/**
 * Estado EFECTIVO del billing, calculado al vuelo comparando `currentPeriodEnd`
 * con el reloj. No depende de un cron que marque `status: 'expired'` — no hay
 * scheduler y el backend en plan free se duerme, así que un job programado no
 * sería confiable. `billing.status` persistido es solo un cache; esta función
 * es la que manda.
 */
export const resolveBilling = (billing: IBilling, now: Date = new Date()): EffectiveBilling => {
  const plan = billing.plan;
  if (plan === "free") return { plan, isActive: false };
  const isActive =
    billing.status === "active" &&
    !!billing.currentPeriodEnd &&
    billing.currentPeriodEnd.getTime() > now.getTime();
  return { plan, isActive };
};

/** Gate de `leaguePermissions.canManageLeagues`: ¿este billing habilita crear/gestionar ligas? */
export const hasActiveSubscription = (billing?: IBilling | null): boolean =>
  !!billing && resolveBilling(billing).isActive;

export type ConsumeSlotResult =
  | { ok: true; plan: PlanId; periodKey: string }
  | {
      ok: false;
      reason: "no_free_slot" | "no_subscription" | "monthly_limit_reached";
      plan: PlanId;
      usage: IBilling["usage"];
    };

/**
 * Consume atómicamente el cupo de creación de UN torneo del usuario dado.
 * Es el corazón del gate de billing — dos llamadas concurrentes con un solo
 * cupo libre (doble click, dos pestañas) deben producir exactamente un
 * éxito, así que todo pasa por un único `findOneAndUpdate` con pipeline: el
 * filtro decide si hay cupo, el update lo consume, y Mongo lo hace atómico a
 * nivel documento. Un `findById → if → save()` regalaría el producto.
 *
 * Plan `free`: cupo de UNA vez de por vida (`tournamentsTotal < 1`), sin
 * pedir suscripción. Planes pagos: exige suscripción vigente y cupo mensual
 * (con reset perezoso de `periodKey` si cambió el mes).
 *
 * `tournamentsTotal` se incrementa SIEMPRE que hay éxito, en los dos casos:
 * es el contador que nunca se decrementa y el que impide reciclar el torneo
 * gratis borrándolo y creando otro.
 */
export const consumeTournamentSlot = async (
  userId: string,
  session?: ClientSession
): Promise<ConsumeSlotResult> => {
  const now = new Date();
  const currentPeriodKey = periodKeyOf(now);
  const user = await User.findById(userId).select("billing").session(session ?? null);
  if (!user) throw new Error("Usuario no encontrado");
  const plan = user.billing.plan;

  // Ambas ramas comparten el mismo `update`: suma 1 al total histórico
  // siempre, y resetea `tournamentsCreated` a 1 si el mes cambió desde la
  // última creación, o lo incrementa si seguimos en el mismo mes. Todas las
  // expresiones de un mismo `$set` de un pipeline se evalúan sobre el
  // documento de ENTRADA al stage, así que leer `billing.usage.periodKey`
  // acá siempre da el valor viejo, no el que este mismo `$set` está por
  // escribir — el orden de las claves no importa.
  const update = [
    {
      $set: {
        "billing.usage.tournamentsTotal": { $add: [{ $ifNull: ["$billing.usage.tournamentsTotal", 0] }, 1] },
        "billing.usage.tournamentsCreated": {
          $cond: [
            { $eq: ["$billing.usage.periodKey", currentPeriodKey] },
            { $add: [{ $ifNull: ["$billing.usage.tournamentsCreated", 0] }, 1] },
            1
          ]
        },
        "billing.usage.periodKey": currentPeriodKey
      }
    }
  ];

  if (plan === "free") {
    const updated = await User.findOneAndUpdate(
      { _id: userId, "billing.usage.tournamentsTotal": { $lt: 1 } },
      update,
      { new: true, session }
    );
    if (!updated) {
      const fresh = await User.findById(userId).select("billing").session(session ?? null);
      return { ok: false, reason: "no_free_slot", plan, usage: fresh!.billing.usage };
    }
    return { ok: true, plan, periodKey: currentPeriodKey };
  }

  const limit = PLANS[plan].tournamentsPerMonth;
  const filter: Record<string, unknown> = {
    _id: userId,
    "billing.status": "active",
    "billing.currentPeriodEnd": { $gt: now }
  };
  // Sin tope (plan Pro) no hace falta la condición de cupo mensual, pero el
  // update sigue sumando el contador igual: es la métrica de uso real.
  if (limit !== Infinity) {
    filter.$or = [
      { "billing.usage.periodKey": { $ne: currentPeriodKey } },
      { "billing.usage.tournamentsCreated": { $lt: limit } }
    ];
  }

  const updated = await User.findOneAndUpdate(filter, update, { new: true, session });
  if (!updated) {
    const fresh = await User.findById(userId).select("billing").session(session ?? null);
    const effective = resolveBilling(fresh!.billing, now);
    return {
      ok: false,
      reason: effective.isActive ? "monthly_limit_reached" : "no_subscription",
      plan,
      usage: fresh!.billing.usage
    };
  }

  return { ok: true, plan, periodKey: currentPeriodKey };
};

/**
 * Devuelve el cupo MENSUAL consumido por un torneo que se borra — pero solo
 * si se borra dentro del mismo `periodKey` en que se creó. Fuera de ese mes
 * no hace nada: ese cupo ya expiró de todos modos, no hay nada que devolver.
 *
 * El cupo del plan `free` (`tournamentsTotal`) NUNCA se devuelve acá ni en
 * ningún otro lado — ver el comentario de `tournamentsTotal` en `User.ts`.
 */
export const releaseTournamentSlot = async (
  userId: string,
  periodKeyAtCreation: string,
  session?: ClientSession
): Promise<void> => {
  await User.updateOne(
    { _id: userId, "billing.usage.periodKey": periodKeyAtCreation },
    { $inc: { "billing.usage.tournamentsCreated": -1 } },
    { session }
  );
  // Nunca queda negativo: si por una carrera rarísima ya se había reseteado
  // el período entre el create y el delete, esto lo clampea en 0 sin abortar
  // la operación de borrado del torneo.
  await User.updateOne(
    { _id: userId, "billing.usage.tournamentsCreated": { $lt: 0 } },
    { $set: { "billing.usage.tournamentsCreated": 0 } },
    { session }
  );
};

/**
 * Activa o extiende N meses de un plan pago. Si ya hay una suscripción
 * vigente, el nuevo período se apila DESPUÉS del vencimiento actual (no se
 * pisa) — así "extender" no le regala tiempo perdido a nadie. Si no hay
 * suscripción vigente, arranca ahora.
 *
 * Registra el `Payment` en la misma transacción: la plata y el acceso se
 * otorgan atómicamente, o no se otorga ninguno de los dos.
 */
export const grantSubscriptionPeriod = async (params: {
  userId: string;
  plan: PlanId;
  interval: SubscriptionInterval;
  months: number;
  activatedBy: string;
  amount?: number;
  idempotencyKey?: string;
}): Promise<{ subscription: ISubscription; payment: IPayment }> => {
  const { userId, plan, interval, months, activatedBy, amount = 0, idempotencyKey } = params;
  if (plan === "free") throw new Error("No se puede otorgar una suscripción al plan free");
  if (months <= 0) throw new Error("`months` debe ser mayor a 0");

  return withTransaction(async (session) => {
    const user = await User.findById(userId).select("billing").session(session ?? null);
    if (!user) throw new Error("Usuario no encontrado");

    const now = new Date();
    const currentlyActive = resolveBilling(user.billing, now).isActive;
    const periodStart = currentlyActive ? user.billing.currentPeriodEnd! : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + months);

    const [subscription] = await Subscription.create(
      [
        {
          userId,
          plan,
          interval,
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          autoRenew: false,
          paymentProvider: "manual",
          activatedBy
        }
      ],
      { session }
    );

    const [payment] = await Payment.create(
      [
        {
          userId,
          subscriptionId: subscription._id,
          plan,
          kind: "subscription_period",
          amount,
          currency: "ARS",
          status: "approved",
          paymentProvider: "manual",
          // `undefined` si no vino: ver el comentario sobre índices sparse en
          // `models/Payment.ts` — pasar `null` acá rompería la idempotencia
          // para todas las demás altas manuales sin idempotencyKey.
          idempotencyKey: idempotencyKey ?? undefined,
          periodStart,
          periodEnd,
          createdBy: activatedBy
        }
      ],
      { session }
    );

    user.billing.plan = plan;
    user.billing.status = "active";
    user.billing.currentPeriodEnd = periodEnd;
    await user.save({ session });

    return { subscription, payment };
  });
};

/**
 * Cambia el plan de un usuario SIN tocar el período vigente ni el contador
 * mensual ya usado (si usó 2 de 2 en Básico y sube a Club, le quedan 4: es lo
 * intuitivo y evita el ciclo de abuso upgrade→downgrade→upgrade).
 *
 * Bajar a `free` sí cierra la suscripción (`status: 'canceled'`,
 * `currentPeriodEnd: null`): no tiene sentido dejar una fecha de vencimiento
 * de un plan que ya no rige. El torneo de prueba no se recupera porque
 * `tournamentsTotal` es aparte y nunca se toca acá.
 */
export const changePlan = async (userId: string, plan: PlanId): Promise<void> => {
  if (plan === "free") {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "billing.plan": "free",
          "billing.status": "canceled",
          "billing.currentPeriodEnd": null
        }
      }
    );
    return;
  }
  await User.updateOne({ _id: userId }, { $set: { "billing.plan": plan } });
};

export interface UsageSummary {
  plan: PlanId;
  status: IBilling["status"];
  isActive: boolean;
  currentPeriodEnd: Date | null;
  usage: IBilling["usage"];
  limits: (typeof PLANS)[PlanId];
}

export const getUsage = async (userId: string): Promise<UsageSummary> => {
  const user = await User.findById(userId).select("billing");
  if (!user) throw new Error("Usuario no encontrado");
  const effective = resolveBilling(user.billing);
  return {
    plan: user.billing.plan,
    status: user.billing.status,
    isActive: effective.isActive,
    currentPeriodEnd: user.billing.currentPeriodEnd ?? null,
    usage: user.billing.usage,
    limits: PLANS[user.billing.plan]
  };
};
