import { useCallback, useEffect, useState } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';
import { BillingHistory } from '../types/billing';

/**
 * Sin cache en memoria (a diferencia de `useBilling`/`usePricing`): esto solo
 * se pide una vez, al abrir la pestaña "Mi Plan", no en varias pantallas.
 * Expone `refresh` para el caso de la vuelta de MercadoPago: la carga inicial
 * puede ganarle a la reconciliación del pago y quedar sin el `Payment` nuevo.
 */
export const useBillingHistory = () => {
  const [history, setHistory] = useState<BillingHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(API_ROUTES.BILLING.HISTORY);
      setHistory(data as BillingHistory);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tu historial');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, loading, error, refresh };
};

export default useBillingHistory;
