import { PlanId } from '../config/plans';

export interface BillingUsage {
  periodKey: string;
  tournamentsCreated: number;
  tournamentsTotal: number;
}

/** `null` en cualquier límite significa "sin tope" (ver config/plans.ts). */
export interface BillingLimits {
  tournamentsLifetime: number | null;
  tournamentsPerMonth: number | null;
  maxLeagues: number;
  maxMembers: number | null;
  maxOrganizers: number | null;
}

/** Respuesta de `GET /billing/me`. */
export interface MyBilling {
  plan: PlanId;
  status: 'none' | 'active' | 'past_due' | 'canceled' | 'expired';
  isActive: boolean;
  currentPeriodEnd: string | null;
  usage: BillingUsage;
  limits: BillingLimits;
}
