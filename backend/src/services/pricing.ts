import PricingConfig from "../models/PricingConfig";

/** Usado solo si nunca se configuró un valor: `/planes` no debe quedar sin precio. */
export const DEFAULT_USD_TO_ARS = 1000;

export const MAX_USD_TO_ARS = 10_000_000;

/**
 * Cache en memoria de ~60s: `/billing/pricing` es público y lo pega la
 * página de precios en cada visita (deslogueada incluida), así que sin
 * cache cada carga sería un round-trip a Mongo por algo que cambia, como
 * mucho, un puñado de veces por semana. Con más de una instancia corriendo
 * el desfasaje máximo entre ellas es este TTL.
 */
const CACHE_TTL_MS = 60_000;
let cache: { value: number; expiresAt: number } | null = null;

export const getUsdToArs = async (): Promise<number> => {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const doc = await PricingConfig.findOne({ key: "global" }).select("usdToArs");
  const value = doc?.usdToArs ?? DEFAULT_USD_TO_ARS;
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
};

export const setUsdToArs = async (value: number, updatedBy: string): Promise<number> => {
  await PricingConfig.findOneAndUpdate(
    { key: "global" },
    { $set: { usdToArs: value, updatedBy } },
    { upsert: true }
  );
  cache = null;
  return value;
};

/** Solo para tests: evita que el cache de un test se filtre al siguiente. */
export const clearPricingCache = (): void => {
  cache = null;
};
