import mongoose, { Schema, Document } from "mongoose";
import { PlanId, PLAN_IDS } from "../config/plans";
import { PaymentProvider } from "./Subscription";

export type PaymentStatus = "pending" | "approved" | "rejected" | "refunded";
export type PaymentKind = "subscription_period" | "manual_grant";

/**
 * Ledger append-only de cobros. Nunca se actualiza ni se borra un registro
 * (salvo `status` al confirmar/rechazar un pago async) — es la auditoría de
 * "quién pagó qué y cuándo", independiente del estado actual de la
 * suscripción en `Subscription`/`User.billing`.
 *
 * El índice único sobre `{paymentProvider, externalId}` ES la idempotencia
 * del futuro webhook de MercadoPago: un reintento con el mismo `externalId`
 * choca con duplicate key y se responde 200 sin volver a acreditar nada. No
 * hace falta lógica de dedupe en el handler.
 */
export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId | null;
  plan: PlanId;
  kind: PaymentKind;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentProvider: PaymentProvider;
  externalId?: string | null;
  externalStatus?: string | null;
  /** Evita duplicar altas manuales si se reenvía el mismo request (doble click). */
  idempotencyKey?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  /** Payload crudo del provider, para auditar sin depender de lo que se haya parseado. */
  rawPayload?: unknown;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    plan: { type: String, enum: PLAN_IDS, required: true },
    kind: { type: String, enum: ["subscription_period", "manual_grant"], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "ARS" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "refunded"],
      required: true,
      default: "approved"
    },
    paymentProvider: { type: String, enum: ["manual", "mercadopago"], required: true, default: "manual" },
    // Sin `default: null` a propósito — ver el comentario equivalente en
    // `Subscription.ts`: con `null` explícito, el índice `sparse` deja de
    // excluir estos campos y dos pagos sin `externalId`/`idempotencyKey`
    // chocan por duplicate key.
    externalId: { type: String },
    externalStatus: { type: String },
    idempotencyKey: { type: String },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    rawPayload: { type: Schema.Types.Mixed, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

// Ver el comentario en `models/Subscription.ts`: `sparse` en un índice
// compuesto no excluye nada acá porque `paymentProvider` siempre tiene
// valor. Hace falta un índice parcial.
paymentSchema.index(
  { paymentProvider: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $exists: true } } }
);
// Este sí es un índice de UN solo campo: acá `sparse` funciona como se espera.
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const Payment = mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;
