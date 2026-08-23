import { useState, useEffect, useCallback } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';
import { UserStatsSummary } from '../types/userStats';

// Igual que useCurrentUser, pero keyed por userId: un admin puede mirar las
// estadísticas de varios usuarios en la misma sesión.
const cache = new Map<string, UserStatsSummary>();
const inFlight = new Map<string, Promise<UserStatsSummary>>();

const fetchUserStats = async (userId: string, minPlayed?: number): Promise<UserStatsSummary> => {
  const cacheKey = `${userId}:${minPlayed ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let promise = inFlight.get(cacheKey);
  if (!promise) {
    promise = apiRequest(API_ROUTES.USERS.STATS_SUMMARY(userId), {
      params: minPlayed ? { minPlayed } : undefined
    })
      .then((data: UserStatsSummary) => {
        cache.set(cacheKey, data);
        return data;
      })
      .finally(() => {
        inFlight.delete(cacheKey);
      });
    inFlight.set(cacheKey, promise);
  }
  return promise;
};

/** Invalida el cache de un usuario (o de todos, sin argumento). */
export const clearUserStatsCache = (userId?: string) => {
  if (!userId) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
};

/** `userId` puede ser `'me'` para pedir las estadísticas del usuario logueado. */
export const useUserStats = (userId: string, minPlayed?: number) => {
  const [stats, setStats] = useState<UserStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    (active: { current: boolean }) => {
      setLoading(true);
      setError('');
      fetchUserStats(userId, minPlayed)
        .then((data) => {
          if (active.current) setStats(data);
        })
        .catch((err) => {
          if (active.current) setError(err instanceof Error ? err.message : 'Error al cargar las estadísticas');
        })
        .finally(() => {
          if (active.current) setLoading(false);
        });
    },
    [userId, minPlayed]
  );

  useEffect(() => {
    const active = { current: true };
    load(active);
    return () => {
      active.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    clearUserStatsCache(userId);
    const active = { current: true };
    load(active);
  }, [userId, load]);

  return { stats, loading, error, refresh };
};

export default useUserStats;
