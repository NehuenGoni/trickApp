import { useCallback, useEffect, useState } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';
import { MyBilling } from '../types/billing';

// Mismo patrón de cache en memoria que `useCurrentUser`: se consulta en
// varias pantallas (Dashboard, LeagueList, CreateTournament, el medidor de
// LeagueDetails) y no tiene sentido repetir el fetch en cada montaje.
let cachedBilling: MyBilling | null = null;
let inFlight: Promise<MyBilling> | null = null;

const fetchBilling = async (): Promise<MyBilling> => {
  if (cachedBilling) return cachedBilling;
  if (!inFlight) {
    inFlight = apiRequest(API_ROUTES.BILLING.ME)
      .then((data) => {
        cachedBilling = data as MyBilling;
        return cachedBilling;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};

/** Invalidar tras crear/borrar un torneo, activar un plan, o cualquier cambio que afecte el uso. */
export const clearBillingCache = () => {
  cachedBilling = null;
};

export const useBilling = () => {
  const [billing, setBilling] = useState<MyBilling | null>(cachedBilling);
  const [loading, setLoading] = useState(!cachedBilling);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    clearBillingCache();
    setLoading(true);
    try {
      const data = await fetchBilling();
      setBilling(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tu plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchBilling()
      .then((data) => {
        if (active) setBilling(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Error al cargar tu plan');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { billing, loading, error, refresh };
};

export default useBilling;
