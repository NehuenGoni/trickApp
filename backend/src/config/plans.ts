/**
 * Import de solo-tipo: se borra en compilación, así que no crea una
 * dependencia circular real con `models/Subscription.ts` (que sí importa
 * `PlanId`/`PLAN_IDS` de este archivo en tiempo de ejecución).
 */
import type { SubscriptionInterval } from "../models/Subscription";
export type { SubscriptionInterval };

/**
 * Catálogo de planes de suscripción. Vive en código, no en la base: cambiar
 * un límite para todos los clientes tiene que ser un deploy auditable, no un
 * `updateMany` silencioso.
 *
 * Espejo en `frontend/src/config/plans.ts` para la pantalla de precios —
 * mantené ambos en sync si cambia algo acá.
 *
 * Los dos ejes de "torneos" son EXCLUYENTES entre sí:
 *  - `tournamentsLifetime`: cupo total de por vida, nunca se resetea. Solo lo
 *    usa `free` (el torneo de prueba, uno solo, para siempre).
 *  - `tournamentsPerMonth`: cupo que se resetea cada mes. Lo usan los planes
 *    pagos. `Infinity` = sin tope (pero el uso se sigue contando, es la
 *    métrica real de cuánto usa cada cliente).
 * Un plan usa un solo eje; el otro queda en `null`.
 */
export const PLANS = {
  free: {
    tournamentsLifetime: 1,
    tournamentsPerMonth: null,
    maxLeagues: 0,
    maxMembers: 0,
    maxOrganizers: 0
  },
  basico: {
    tournamentsLifetime: null,
    tournamentsPerMonth: 2,
    maxLeagues: 1,
    maxMembers: 40,
    maxOrganizers: 0
  },
  club: {
    tournamentsLifetime: null,
    tournamentsPerMonth: 4,
    maxLeagues: 1,
    maxMembers: 100,
    maxOrganizers: 3
  },
  pro: {
    tournamentsLifetime: null,
    tournamentsPerMonth: Infinity,
    maxLeagues: 3,
    maxMembers: Infinity,
    maxOrganizers: Infinity
  }
} as const;

export type PlanId = keyof typeof PLANS;

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const isValidPlanId = (value: unknown): value is PlanId =>
  typeof value === "string" && (PLAN_IDS as string[]).includes(value);

/** Un plan "paga" cuando gasta contra el cupo mensual (no el de por vida). */
export const isPaidPlan = (plan: PlanId): boolean => PLANS[plan].tournamentsPerMonth !== null;

/** `'YYYY-MM'` del momento dado (UTC), la unidad con la que se resetea el cupo mensual. */
export const periodKeyOf = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * Catálogo comercial (nombres y precios), separado a propósito de `PLANS`
 * (límites de uso). `getUsage()` devuelve `PLANS[plan]` tal cual como
 * `limits`, y mezclar precios ahí haría que `serializeUsage` los iterara
 * como si fueran límites. Espejo en `frontend/src/config/plans.ts` para la
 * grilla de precios — pero desde acá se calcula el monto real a cobrar.
 */
export const PLAN_CATALOG: Record<
  PlanId,
  {
    label: string;
    /** Precio de referencia en USD. El cobro real es en pesos. */
    priceUsdMonthly: number | null;
    /** `null` = no hay oferta anual; se cobra `priceUsdMonthly * 12`. */
    priceUsdYearly: number | null;
    highlight?: boolean;
  }
> = {
  free: { label: "Free", priceUsdMonthly: null, priceUsdYearly: null },
  basico: { label: "Básico", priceUsdMonthly: 20, priceUsdYearly: null },
  club: { label: "Club", priceUsdMonthly: 30, priceUsdYearly: 300, highlight: true },
  pro: { label: "Pro", priceUsdMonthly: 50, priceUsdYearly: 500 }
};

/** Meses que cubre cada ciclo de facturación. */
export const MONTHS_PER_INTERVAL: Record<SubscriptionInterval, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12
};

export const monthsForInterval = (interval: SubscriptionInterval): number =>
  MONTHS_PER_INTERVAL[interval];

/** Redondea a la centena para no publicar precios como "$43.517". */
export const arsPrice = (usd: number, usdToArs: number): number =>
  Math.round((usd * usdToArs) / 100) * 100;

/**
 * Precio en USD del plan para el ciclo elegido. Anual sin oferta específica
 * = mensual × 12. `null` = plan gratis, no se cobra nada.
 */
export const usdPriceFor = (plan: PlanId, interval: SubscriptionInterval): number | null => {
  const { priceUsdMonthly, priceUsdYearly } = PLAN_CATALOG[plan];
  if (priceUsdMonthly === null) return null;
  if (interval === "monthly") return priceUsdMonthly;
  if (interval === "yearly") return priceUsdYearly ?? priceUsdMonthly * 12;
  return priceUsdMonthly * monthsForInterval(interval); // quarterly: sin oferta propia
};

/**
 * Monto en ARS a cobrar por el plan y ciclo dados, al tipo de cambio
 * vigente. Única fuente del monto: nunca se acepta un `amount` del cliente.
 */
export const priceArsFor = (
  plan: PlanId,
  interval: SubscriptionInterval,
  usdToArs: number
): number | null => {
  const usd = usdPriceFor(plan, interval);
  if (usd === null) return null;
  return arsPrice(usd, usdToArs);
};
