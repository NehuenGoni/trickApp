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
  priceUsd: number | null;
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
    priceUsd: null,
    tournamentsLifetime: 1,
    tournamentsPerMonth: null,
    maxLeagues: 0,
    maxMembers: null,
    maxOrganizers: null
  },
  {
    id: 'basico',
    label: 'Básico',
    priceUsd: 20,
    tournamentsLifetime: null,
    tournamentsPerMonth: 2,
    maxLeagues: 1,
    maxMembers: 40,
    maxOrganizers: 0
  },
  {
    id: 'club',
    label: 'Club',
    priceUsd: 30,
    tournamentsLifetime: null,
    tournamentsPerMonth: 6,
    maxLeagues: 1,
    maxMembers: 150,
    maxOrganizers: 3,
    highlight: true
  },
  {
    id: 'pro',
    label: 'Pro',
    priceUsd: 50,
    tournamentsLifetime: null,
    tournamentsPerMonth: null,
    maxLeagues: 3,
    maxMembers: null,
    maxOrganizers: null
  }
];

export const planById = (id: PlanId): PlanDefinition =>
  PLAN_DEFINITIONS.find((p) => p.id === id) ?? PLAN_DEFINITIONS[0];
