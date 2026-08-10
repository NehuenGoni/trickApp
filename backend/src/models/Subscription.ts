import mongoose, { Schema, Document } from "mongoose";
import { PlanId, PLAN_IDS } from "../config/plans";

export type SubscriptionInterval = "monthly" | "quarterly" | "yearly";
/**
 * `pending`: preapproval de MercadoPago creado pero todavía no autorizado por
 * el pagador (está en el `init_point` eligiendo método de pago). No tiene
 * `currentPeriodStart`/`currentPeriodEnd` todavía — el webhook los completa
 * recién cuando MP confirma `authorized`. El resto de los estados siempre
 * corresponden a una suscripción que llegó a tener al menos un período.
 */
export type SubscriptionStatus = "pending" | "active" | "past_due" | "canceled" | "expired";
export type PaymentProvider = "manual" | "mercadopago";

/**
 * Historial de períodos de suscripción de un usuario. `User.billing` es el
 * cache derivado que se lee en el camino caliente (gating); esta colección es
 * la fuente de verdad histórica — de acá se puede reconstruir el cache si
 * hiciera falta, nunca al revés.
 *
 * `paymentProvider` + `externalId` guardan el `preapproval_id` de MercadoPago
 * para las suscripciones de ese proveedor (ver `services/mercadopago.ts`).
 */
export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  plan: PlanId;
  interval: SubscriptionInterval;
  status: SubscriptionStatus;
  /** `null` mientras la suscripción está `pending` (preapproval sin autorizar). */
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
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
      enum: ["pending", "active", "past_due", "canceled", "expired"],
      required: true,
      default: "active"
    },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
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
