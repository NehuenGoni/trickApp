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
    tournamentsPerMonth: 6,
    maxLeagues: 1,
    maxMembers: 150,
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
