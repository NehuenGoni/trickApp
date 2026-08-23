import { PlanId } from '../config/plans';

export type SubscriptionInterval = 'monthly' | 'quarterly' | 'yearly';
export type PaymentProvider = 'manual' | 'mercadopago';

export interface BillingUsage {
  periodKey: string;
  tournamentsCreated: number;
  tournamentsTotal: number;
  leaguesUsed: number;
  /** Jugadores únicos de la liga propia con MÁS gente — `maxMembers` es un tope por liga, no global. */
  playersInLargestLeague: number;
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
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  interval: SubscriptionInterval | null;
  autoRenew: boolean;
  paymentProvider: PaymentProvider | null;
  usage: BillingUsage;
  limits: BillingLimits;
}

export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled' | 'expired';

/** Un registro de `GET /billing/history` — un período contratado. */
export interface SubscriptionRecord {
  _id: string;
  plan: PlanId;
  interval: SubscriptionInterval;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  paymentProvider: PaymentProvider;
  canceledAt: string | null;
  createdAt: string;
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';
export type PaymentKind = 'subscription_period' | 'manual_grant';

/** Un registro de `GET /billing/history` — un cobro puntual. */
export interface PaymentRecord {
  _id: string;
  plan: PlanId;
  kind: PaymentKind;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentProvider: PaymentProvider;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

/** Respuesta de `GET /billing/history`. */
export interface BillingHistory {
  subscriptions: SubscriptionRecord[];
  payments: PaymentRecord[];
}
