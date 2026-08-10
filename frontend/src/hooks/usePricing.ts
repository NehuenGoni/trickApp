import { useEffect, useState } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';
import { PricingPlan } from '../config/plans';

interface PricingData {
  usdToArs: number;
  mercadoPagoEnabled: boolean;
  plans: PricingPlan[];
}

// Mismo patrón de cache en memoria que `useBilling`: la página de precios es
// pública y se puede visitar sin login, así que conviene no repetir el fetch
// en cada montaje del componente.
let cachedPricing: PricingData | null = null;
let inFlight: Promise<PricingData> | null = null;

const fetchPricing = async (): Promise<PricingData> => {
  if (cachedPricing) return cachedPricing;
  if (!inFlight) {
    inFlight = apiRequest(API_ROUTES.BILLING.PRICING)
      .then((data) => {
        cachedPricing = data as PricingData;
        return cachedPricing;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};

/** Invalidar tras editar el tipo de cambio desde `/admin/pricing`. */
export const clearPricingCache = () => {
  cachedPricing = null;
};

export const usePricing = () => {
  const [data, setData] = useState<PricingData | null>(cachedPricing);
  const [loading, setLoading] = useState(!cachedPricing);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetchPricing()
      .then((fetched) => {
        if (active) setData(fetched);
      })
      .catch((err) => {
        // Si falla, la página de planes sigue funcionando mostrando solo USD.
        if (active) setError(err instanceof Error ? err.message : 'Error al cargar los precios');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    usdToArs: data?.usdToArs ?? null,
    mercadoPagoEnabled: data?.mercadoPagoEnabled ?? false,
    plans: data?.plans ?? [],
    loading,
    error
  };
};

export default usePricing;
