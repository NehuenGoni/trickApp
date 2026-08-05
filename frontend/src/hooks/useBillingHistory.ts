import { useEffect, useState } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';
import { BillingHistory } from '../types/billing';

/**
 * Sin cache en memoria (a diferencia de `useBilling`/`usePricing`): esto solo
 * se pide una vez, al abrir la pestaña "Mi Plan", no en varias pantallas.
 */
export const useBillingHistory = () => {
  const [history, setHistory] = useState<BillingHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    apiRequest(API_ROUTES.BILLING.HISTORY)
      .then((data) => {
        if (active) setHistory(data as BillingHistory);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Error al cargar tu historial');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { history, loading, error };
};

export default useBillingHistory;
