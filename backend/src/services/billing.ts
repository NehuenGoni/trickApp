import mongoose, { ClientSession } from "mongoose";
import User, { IBilling } from "../models/User";
import Subscription, { ISubscription, SubscriptionInterval, PaymentProvider } from "../models/Subscription";
import { PreapprovalStatus, getPreapproval, searchAuthorizedPayments } from "./mercadopago";
import Payment, { IPayment } from "../models/Payment";
import League from "../models/League";
import { computeLeaguePlayerCounts } from "../utils/leaguePlayers";
import { PLANS, PlanId, periodKeyOf, monthsForInterval } from "../config/plans";
import { withTransaction } from "../utils/withTransaction";
import { notifyPaymentApproved } from "./notifications";
import { notifyAdminPaymentApproved } from "./adminAlerts";
import { EXPIRY_REMINDER_WINDOW_DAYS } from "../config/constants";

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
 * Suscripción de MercadoPago vigente o en curso de un usuario (si la hay):
 * la que el checkout debe cancelar antes de crear una nueva, y la que el
 * botón "cancelar renovación" del usuario apunta a dar de baja.
 */
export const findActiveProviderSubscription = async (userId: string): Promise<ISubscription | null> =>
  Subscription.findOne({
    userId,
    paymentProvider: "mercadopago",
    status: { $in: ["pending", "active", "past_due"] }
  }).sort({ createdAt: -1 });

/**
 * Crea el registro local de una suscripción de MercadoPago ANTES de llamar a
 * la API de MP: todavía no tiene período ni `externalId` (se completa con
 * `setSubscriptionExternalId` apenas MP devuelve el `preapproval_id`). Vive
 * en `pending` hasta que el usuario autorice el pago en el `init_point`.
 */
export const createPendingProviderSubscription = async (params: {
  userId: string;
  plan: PlanId;
  interval: SubscriptionInterval;
}): Promise<ISubscription> =>
  Subscription.create({
    userId: params.userId,
    plan: params.plan,
    interval: params.interval,
    status: "pending",
    autoRenew: false,
    paymentProvider: "mercadopago"
  });

export const setSubscriptionExternalId = async (subscriptionId: string, externalId: string): Promise<void> => {
  await Subscription.updateOne({ _id: subscriptionId }, { $set: { externalId } });
};

/**
 * Refleja en la suscripción local el estado del "mandato" de MercadoPago
 * (`subscription_preapproval` webhook). NO otorga ni extiende acceso — eso
 * solo pasa cuando se confirma un cobro real (`applyProviderSubscriptionCharge`,
 * disparado por `subscription_authorized_payment`). Evita que un usuario
 * quede con el período pagado dos veces si ambos webhooks llegan para el
 * mismo ciclo.
 *
 * `paused`/`cancelled` sí actúan de inmediato sobre `autoRenew`: el acceso
 * ya pagado sigue corriendo hasta `currentPeriodEnd` (lo expira `resolveBilling`
 * solo), pero no se va a renovar.
 */
export const updateSubscriptionMandateStatus = async (params: {
  externalId: string;
  mpStatus: PreapprovalStatus;
}): Promise<ISubscription | null> => {
  const subscription = await Subscription.findOne({
    paymentProvider: "mercadopago",
    externalId: params.externalId
  });
  if (!subscription) return null;

  subscription.externalStatus = params.mpStatus;
  if (params.mpStatus === "paused" || params.mpStatus === "cancelled") {
    subscription.autoRenew = false;
    subscription.canceledAt = subscription.canceledAt ?? new Date();
  }
  await subscription.save();
  return subscription;
};

/**
 * Acredita UN cobro confirmado por MercadoPago (`subscription_authorized_payment`
 * en estado `approved`): apila el período sobre el vencimiento vigente (o lo
 * arranca ahora si es el primer cobro) y dispara `User.billing` en la misma
 * transacción — mismo criterio que `grantSubscriptionPeriod`, pero indexado
 * por `subscriptionId` en vez de `userId` porque acá no hay un admin del otro
 * lado decidiendo el plan.
 *
 * Idempotencia: se chequea ANTES de abrir la transacción si ya existe un
 * `Payment` con este `externalId` — así un reintento del mismo webhook (MP
 * reintenta ante cualquier respuesta que no sea 200) no duplica el período.
 * Si dos entregas llegan en simultáneo, el índice único de `Payment` aborta
 * la transacción perdedora y el caller decide si reintentar.
 */
export type ProviderChargeResult =
  | { subscription: ISubscription; payment: IPayment }
  | { duplicate: true }
  | { notFound: true };

export const applyProviderSubscriptionCharge = async (params: {
  subscriptionId: string;
  amount: number;
  externalId: string;
}): Promise<ProviderChargeResult> => {
  const { subscriptionId, amount, externalId } = params;

  const alreadyProcessed = await Payment.exists({ paymentProvider: "mercadopago", externalId });
  if (alreadyProcessed) return { duplicate: true };

  // El genérico explícito evita que TypeScript ensanche `notFound: true` a
  // `boolean` al pasar por una variable intermedia en vez de retornar directo.
  const result = await withTransaction<ProviderChargeResult>(async (session) => {
    const subscription = await Subscription.findById(subscriptionId).session(session ?? null);
    if (!subscription) return { notFound: true };

    const now = new Date();
    const months = monthsForInterval(subscription.interval);
    const hasActivePeriod = !!subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() > now.getTime();
    const periodStart = hasActivePeriod ? subscription.currentPeriodEnd! : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + months);

    subscription.status = "active";
    if (!subscription.currentPeriodStart) subscription.currentPeriodStart = periodStart;
    subscription.currentPeriodEnd = periodEnd;
    subscription.autoRenew = true;
    await subscription.save({ session });

    const [payment] = await Payment.create(
      [
        {
          userId: subscription.userId,
          subscriptionId: subscription._id,
          plan: subscription.plan,
          kind: "subscription_period",
          amount,
          currency: "ARS",
          status: "approved",
          paymentProvider: "mercadopago",
          externalId,
          periodStart,
          periodEnd
        }
      ],
      { session }
    );

    await User.updateOne(
      { _id: subscription.userId },
      {
        $set: {
          "billing.plan": subscription.plan,
          "billing.status": "active",
          "billing.currentPeriodEnd": periodEnd
        }
      },
      { session }
    );

    return { subscription, payment };
  });

  // El aviso de cobro se dispara ACÁ y no en los callers a propósito. Cuando
  // vivía en el webhook, un pago acreditado por el sync de la vuelta del
  // checkout o por el cron no generaba ningún mail: el cliente pagaba y nunca
  // recibía su comprobante. Y no es un caso de borde — en sandbox MP no
  // notifica nunca, y en producción alcanza con que el webhook demore más que
  // la vuelta del usuario. Junto a la acreditación, los tres caminos avisan
  // igual.
  //
  // Va después del commit y fuera de la transacción (misma regla que el resto
  // de `notifications.ts`): avisar de un cobro que todavía puede revertirse
  // sería peor que avisar tarde. Un `duplicate` no llega hasta acá, así que
  // los reintentos de webhook de MP no re-mandan el mail.
  if ("subscription" in result) {
    void notifyPaymentApproved(
      String(result.subscription.userId),
      result.subscription.plan,
      result.subscription.currentPeriodEnd ?? null
    );
    // Alerta interna al mail del dueño — mismo evento, mismo criterio de "fuera
    // de la transacción y después del commit". Ver `adminAlerts.ts`.
    void notifyAdminPaymentApproved({
      userId: String(result.subscription.userId),
      subscriptionId: String(result.subscription._id),
      plan: result.subscription.plan,
      interval: result.subscription.interval,
      amount: result.payment.amount,
      currency: result.payment.currency,
      currentPeriodEnd: result.subscription.currentPeriodEnd ?? null
    });
  }

  return result;
};

/** Un cobro recurrente rechazado no toca el período pagado, pero marca la cuenta como en mora. */
export const markSubscriptionPastDue = async (userId: string): Promise<void> => {
  await User.updateOne({ _id: userId }, { $set: { "billing.status": "past_due" } });
};

/**
 * Reconciliación de respaldo: no hay que depender 100% de que el webhook de
 * MercadoPago llegue (en sandbox directamente puede no llegar nunca; en
 * producción también puede demorarse o perderse una entrega puntual). Se
 * dispara cuando el usuario vuelve del checkout (`?mp=return`) y hace lo
 * mismo que harían los dos webhooks juntos, pero consultando el estado real
 * en la API de MP en vez de esperar la notificación.
 */
export const reconcileProviderSubscription = async (userId: string): Promise<void> => {
  const subscription = await findActiveProviderSubscription(userId);
  if (!subscription?.externalId) return;

  const preapproval = await getPreapproval(subscription.externalId);
  await updateSubscriptionMandateStatus({ externalId: preapproval.id, mpStatus: preapproval.status });

  if (preapproval.status !== "authorized") return;

  const authorizedPayments = await searchAuthorizedPayments(preapproval.id);
  const approved = authorizedPayments
    .filter((p) => p.payment?.status === "approved")
    .sort((a, b) => new Date(a.date_created ?? 0).getTime() - new Date(b.date_created ?? 0).getTime());

  for (const authorizedPayment of approved) {
    await applyProviderSubscriptionCharge({
      subscriptionId: String(subscription._id),
      amount: authorizedPayment.transaction_amount,
      externalId: String(authorizedPayment.id)
    });
  }
};

/**
 * Barrido para el caso que ni el webhook ni la vuelta del usuario cubren: paga
 * y cierra la pestaña de MercadoPago sin volver a la app. Nadie dispara
 * `reconcileProviderSubscription` para ese usuario, así que la suscripción
 * queda `pending` para siempre aunque MP ya haya cobrado.
 *
 * Pensado para un disparador externo (cron-job.org, GitHub Actions, etc.)
 * porque el proceso no corre 24/7 (duerme en el hosting free) — no sirve un
 * `setInterval` en memoria. El margen de 5 minutos evita pisarle el paso a un
 * checkout que el usuario todavía está completando.
 */
export const reconcileStalePendingSubscriptions = async (
  olderThanMinutes = 5
): Promise<{ checked: number; users: string[] }> => {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const stale = await Subscription.find({
    paymentProvider: "mercadopago",
    status: "pending",
    createdAt: { $lt: cutoff }
  }).select("userId");

  const userIds = [...new Set(stale.map((s) => String(s.userId)))];
  for (const userId of userIds) {
    await reconcileProviderSubscription(userId);
  }
  return { checked: stale.length, users: userIds };
};

export interface ExpiryReminderCandidate {
  userId: string;
  username: string;
  email: string;
  plan: PlanId;
  currentPeriodEnd: Date;
}

/**
 * Usuarios con una suscripción activa que vence dentro de la ventana
 * `EXPIRY_REMINDER_WINDOW_DAYS` (hoy: entre 3 y 4 días), que todavía no
 * recibieron el recordatorio PARA ESE vencimiento puntual, y que además NO
 * tienen débito automático en curso — a quien MP le va a cobrar solo, "tu
 * plan vence pronto" no es accionable, así que no se le manda.
 *
 * La idempotencia no se resuelve con una marca de tiempo y una ventana de
 * comparación (frágil si el cron corre a horarios irregulares), sino
 * guardando en `billing.lastExpiryReminderAt` el propio `currentPeriodEnd`
 * que se avisó: mientras no cambie, no se vuelve a mandar; si la suscripción
 * se renueva y el vencimiento se mueve, automáticamente vuelve a calificar.
 */
export const findUsersNeedingExpiryReminder = async (
  now: Date = new Date()
): Promise<ExpiryReminderCandidate[]> => {
  const from = new Date(now.getTime() + EXPIRY_REMINDER_WINDOW_DAYS.from * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + EXPIRY_REMINDER_WINDOW_DAYS.to * 24 * 60 * 60 * 1000);

  const users = await User.find({
    "billing.status": "active",
    "billing.currentPeriodEnd": { $gte: from, $lt: to },
    $expr: { $ne: ["$billing.currentPeriodEnd", "$billing.lastExpiryReminderAt"] }
  }).select("username email billing");

  if (users.length === 0) return [];

  // Segunda query, acotada solo a los candidatos que ya pasaron el filtro de
  // arriba (nunca a toda la tabla de Subscription): quiénes de ellos tienen
  // débito automático activo AHORA MISMO, para excluirlos.
  const autoRenewing = await Subscription.find({
    userId: { $in: users.map((u) => u._id) },
    paymentProvider: "mercadopago",
    status: "active",
    autoRenew: true
  }).select("userId");
  const autoRenewingIds = new Set(autoRenewing.map((s) => String(s.userId)));

  return users
    .filter((u) => !autoRenewingIds.has(String(u._id)))
    .map((u) => ({
      userId: String(u._id),
      username: u.username,
      email: u.email,
      plan: u.billing.plan,
      currentPeriodEnd: u.billing.currentPeriodEnd!
    }));
};

/**
 * Marca el vencimiento actual como ya avisado. Se llama para TODOS los
 * candidatos del barrido, incluso si el envío individual falló — igual que
 * el resto de los avisos informativos del sistema, un fallo de mail no debe
 * generar reintentos infinitos en cada corrida del cron.
 */
export const markExpiryReminderSent = async (userId: string, currentPeriodEnd: Date): Promise<void> => {
  await User.updateOne({ _id: userId }, { $set: { "billing.lastExpiryReminderAt": currentPeriodEnd } });
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
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  interval: SubscriptionInterval | null;
  autoRenew: boolean;
  paymentProvider: PaymentProvider | null;
  usage: IBilling["usage"] & { leaguesUsed: number; playersInLargestLeague: number };
  limits: (typeof PLANS)[PlanId];
}

/**
 * `currentPeriodStart`/`interval`/`autoRenew` no viven en `User.billing`
 * (ese cache solo guarda lo que el gate necesita: plan, status, vencimiento).
 * Se completan leyendo la `Subscription` que está "en fuerza" ahora mismo —
 * la más reciente en `active`/`past_due` — para que el usuario vea desde
 * cuándo paga y si tiene débito automático activo.
 */
export const getUsage = async (userId: string): Promise<UsageSummary> => {
  const [user, subscription, ownedLeagues] = await Promise.all([
    User.findById(userId).select("billing"),
    Subscription.findOne({ userId, status: { $in: ["active", "past_due"] } }).sort({ currentPeriodEnd: -1 }),
    League.find({ createdBy: userId }).select("_id").lean<{ _id: mongoose.Types.ObjectId }[]>()
  ]);
  if (!user) throw new Error("Usuario no encontrado");
  const effective = resolveBilling(user.billing);
  const leaguesUsed = ownedLeagues.length;
  // `maxMembers` es un tope POR LIGA, no global: la métrica que importa es
  // el máximo entre las ligas propias (la que primero va a chocar contra el
  // gate), no la suma de todas.
  const playerCountsByLeague = await computeLeaguePlayerCounts(ownedLeagues.map((l) => l._id));
  const playersInLargestLeague = Math.max(0, ...[...playerCountsByLeague.values()].map((c) => c.playerCount));
  return {
    plan: user.billing.plan,
    status: user.billing.status,
    isActive: effective.isActive,
    currentPeriodStart: subscription?.currentPeriodStart ?? null,
    currentPeriodEnd: user.billing.currentPeriodEnd ?? null,
    interval: subscription?.interval ?? null,
    autoRenew: subscription?.autoRenew ?? false,
    paymentProvider: subscription?.paymentProvider ?? null,
    // OJO: `user.billing.usage` es un subdocumento de Mongoose — sus campos
    // viven en el prototipo compilado del schema, no como propiedades PROPIAS
    // del objeto, así que un `{ ...user.billing.usage }` los pierde todos en
    // silencio (spread solo copia own enumerable properties). Hay que
    // nombrarlos explícitamente.
    usage: {
      periodKey: user.billing.usage.periodKey,
      tournamentsCreated: user.billing.usage.tournamentsCreated,
      tournamentsTotal: user.billing.usage.tournamentsTotal,
      leaguesUsed,
      playersInLargestLeague
    },
    limits: PLANS[user.billing.plan]
  };
};
