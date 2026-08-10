/**
 * Espejo de `backend/src/config/plans.ts` — mantené ambos en sync si cambia
 * algo acá. Solo para mostrar la grilla de precios y los medidores de uso;
 * la fuente de verdad de qué se permite es siempre el backend.
 *
 * `null` en `tournamentsPerMonth`/`maxMembers`/`maxOrganizers`/`maxLeagues`
 * significa "sin tope" (así serializa el backend `Infinity` en JSON — ver
 * `billing.controller.ts`), no "dato faltante".
 */
export type PlanId = 'free' | 'basico' | 'club' | 'pro';

export interface PlanDefinition {
  id: PlanId;
  label: string;
  /** Precio de referencia en USD. El cobro real es en pesos — ver `usePricing`. */
  priceUsdMonthly: number | null;
  /**
   * Precio anual con descuento, en USD. `null` = no hay oferta anual para
   * este plan; la UI muestra `priceUsdMonthly * 12` sin chip de ahorro.
   */
  priceUsdYearly: number | null;
  tournamentsLifetime: number | null;
  tournamentsPerMonth: number | null;
  maxLeagues: number;
  maxMembers: number | null;
  maxOrganizers: number | null;
  highlight?: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'free',
    label: 'Free',
    priceUsdMonthly: null,
    priceUsdYearly: null,
    tournamentsLifetime: 1,
    tournamentsPerMonth: null,
    maxLeagues: 0,
    maxMembers: null,
    maxOrganizers: null
  },
  {
    id: 'basico',
    label: 'Básico',
    priceUsdMonthly: 20,
    priceUsdYearly: null,
    tournamentsLifetime: null,
    tournamentsPerMonth: 2,
    maxLeagues: 1,
    maxMembers: 40,
    maxOrganizers: 0
  },
  {
    id: 'club',
    label: 'Club',
    priceUsdMonthly: 30,
    priceUsdYearly: 300,
    tournamentsLifetime: null,
    tournamentsPerMonth: 4,
    maxLeagues: 1,
    maxMembers: 100,
    maxOrganizers: 3,
    highlight: true
  },
  {
    id: 'pro',
    label: 'Pro',
    priceUsdMonthly: 50,
    priceUsdYearly: 500,
    tournamentsLifetime: null,
    tournamentsPerMonth: null,
    maxLeagues: 3,
    maxMembers: null,
    maxOrganizers: null
  }
];

export const planById = (id: PlanId): PlanDefinition =>
  PLAN_DEFINITIONS.find((p) => p.id === id) ?? PLAN_DEFINITIONS[0];

/** Redondea a la centena para no publicar precios como "$43.517". */
export const arsPrice = (usd: number, usdToArs: number): number =>
  Math.round((usd * usdToArs) / 100) * 100;

export const formatArs = (value: number): string => `$${value.toLocaleString('es-AR')}`;

/** Mismos límites que `PlanDefinition`, pero sin los ejes de precio. */
export interface PlanLimits {
  tournamentsLifetime: number | null;
  tournamentsPerMonth: number | null;
  maxLeagues: number;
  maxMembers: number | null;
  maxOrganizers: number | null;
}

/**
 * Un plan tal como lo devuelve `GET /billing/pricing`: precio y límites ya
 * resueltos por el backend (fuente de verdad real de cuánto se cobra). A
 * diferencia de `PLAN_DEFINITIONS` (mirror estático usado en el panel de
 * admin), esto es lo que `/planes` y "Mi Plan" usan para mostrar precios y
 * armar el checkout — nunca se calcula un monto en el cliente.
 */
export interface PricingPlan {
  id: PlanId;
  label: string;
  priceUsdMonthly: number | null;
  priceUsdYearly: number | null;
  priceArsMonthly: number | null;
  priceArsYearly: number | null;
  highlight: boolean;
  limits: PlanLimits;
}
