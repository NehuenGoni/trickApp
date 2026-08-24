import { useState, useEffect } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';
import { UserMatchesPage } from '../types/userStats';

/**
 * Listado paginado de partidos de un usuario. Sin cache a propósito: a
 * diferencia de useUserStats, acá cada cambio de página es un fetch nuevo.
 *
 * El fetch está gobernado por las deps del efecto (no por un click handler
 * que cierre sobre `page`/`pageSize` viejos) — es la corrección estructural
 * del bug de paginación que tenía Stats.tsx: llamar `fetchUserStats()` justo
 * después de `setCurrentPage(value)` usaba el `currentPage` de la clausura
 * anterior y siempre pedía la misma página.
 */
export const useUserMatches = (userId: string, page: number, pageSize: number) => {
  const [matches, setMatches] = useState<UserMatchesPage['matches']>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const skip = (page - 1) * pageSize;
    apiRequest(API_ROUTES.USERS.STATS(userId), { params: { skip, limit: pageSize } })
      .then((data: UserMatchesPage) => {
        if (!active) return;
        setMatches(data.matches);
        setTotal(data.total);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar los partidos');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, page, pageSize]);

  return { matches, total, loading, error };
};

export default useUserMatches;
