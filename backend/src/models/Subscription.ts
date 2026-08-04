import mongoose, { Schema, Document } from "mongoose";
import { PlanId, PLAN_IDS } from "../config/plans";

export type SubscriptionInterval = "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired";
export type PaymentProvider = "manual" | "mercadopago";

/**
 * Historial de períodos de suscripción de un usuario. `User.billing` es el
 * cache derivado que se lee en el camino caliente (gating); esta colección es
 * la fuente de verdad histórica — de acá se puede reconstruir el cache si
 * hiciera falta, nunca al revés.
 *
 * `paymentProvider` + `externalId` quedan listos desde ya para el día que se
 * integre MercadoPago (guardarían el `preapproval_id`): activar el webhook no
 * requiere migrar esta colección, solo empezar a poblar esos dos campos.
 */
export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  plan: PlanId;
  interval: SubscriptionInterval;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  autoRenew: boolean;
  paymentProvider: PaymentProvider;
  externalId?: string | null;
  externalStatus?: string | null;
  /** Quién la activó en modo manual (superadmin). Null si vino de un webhook. */
  activatedBy?: mongoose.Types.ObjectId | null;
  canceledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: String, enum: PLAN_IDS, required: true },
    interval: { type: String, enum: ["monthly", "quarterly", "yearly"], required: true },
    status: {
      type: String,
      enum: ["active", "past_due", "canceled", "expired"],
      required: true,
      default: "active"
    },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    autoRenew: { type: Boolean, default: false },
    paymentProvider: { type: String, enum: ["manual", "mercadopago"], required: true, default: "manual" },
    // OJO: sin `default`, a propósito. Un `default: null` haría que Mongoose
    // guarde el campo con valor `null` en TODOS los documentos manuales, y un
    // índice `sparse` solo excluye documentos donde el campo está AUSENTE —
    // `null` cuenta como valor real. Con `default: null` dos suscripciones
    // manuales (sin `externalId`) chocarían entre sí por duplicate key en
    // `{paymentProvider, externalId}`. Dejar el campo simplemente sin setear
    // es lo que lo mantiene fuera del índice.
    externalId: { type: String },
    externalStatus: { type: String },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    canceledAt: { type: Date, default: null }
  },
  { timestamps: true }
);

subscriptionSchema.index({ userId: 1, status: 1 });
// `sparse` en un índice COMPUESTO solo excluye un documento si TODOS sus
// campos están ausentes — acá `paymentProvider` siempre tiene valor (es
// `required`), así que un `sparse` común no excluiría nunca nada y las
// suscripciones manuales (sin `externalId`) chocarían entre sí. Un índice
// PARCIAL con `partialFilterExpression` sí permite condicionar la
// unicidad a un solo campo del índice.
subscriptionSchema.index(
  { paymentProvider: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $exists: true } } }
);

const Subscription = mongoose.model<ISubscription>("Subscription", subscriptionSchema);

export default Subscription;
