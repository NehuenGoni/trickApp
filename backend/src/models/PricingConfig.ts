import mongoose, { Schema, Document } from "mongoose";

/**
 * Singleton (un único documento, `key: "global"`) con el tipo de cambio
 * USD → ARS que usa la página de precios. Los planes en sí (límites y
 * precios en USD) siguen viviendo en código — ver `config/plans.ts` — pero
 * el dólar cambia todo el tiempo y no tiene sentido que mover ese número
 * requiera un deploy. Esto sí vive en la base, a propósito.
 */
export interface IPricingConfig extends Document {
  key: string;
  usdToArs: number;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const pricingConfigSchema = new Schema<IPricingConfig>(
  {
    key: { type: String, default: "global", unique: true, immutable: true },
    usdToArs: { type: Number, required: true, min: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

const PricingConfig = mongoose.model<IPricingConfig>("PricingConfig", pricingConfigSchema);

export default PricingConfig;
