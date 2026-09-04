import { useState, useEffect } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';
import { LeagueListItem } from '../types/league';

/**
 * IDs de las ligas que el usuario logueado administra (`GET /leagues/mine`,
 * ya filtrado server-side con el mismo criterio que `canManageLeague`/
 * `canManageTournament` del backend). Se cachea en memoria como
 * `useCurrentUser`: esta lista se consulta en cada torneo que se abre, así
 * que evita repetir el fetch en cada montaje.
 *
 * Sirve para el espejo de `canManageTournament` del backend en
 * `utils/tournamentPermissions.ts`: un torneo lo administra su liga si esa
 * liga aparece acá.
 */
let cachedLeagueIds: Set<string> | null = null;
let inFlight: Promise<Set<string>> | null = null;

const fetchManageableLeagueIds = async (): Promise<Set<string>> => {
  if (cachedLeagueIds) return cachedLeagueIds;
  if (!inFlight) {
    inFlight = apiRequest(API_ROUTES.LEAGUES.MINE)
      .then((data: LeagueListItem[]) => {
        cachedLeagueIds = new Set(data.map((l) => l._id));
        return cachedLeagueIds;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};

/** Invalida el cache: llamarlo al cerrar sesión, igual que `clearCurrentUserCache`. */
export const clearManageableLeaguesCache = () => {
  cachedLeagueIds = null;
};

export const useManageableLeagues = () => {
  const [leagueIds, setLeagueIds] = useState<Set<string>>(cachedLeagueIds ?? new Set());
  const [loading, setLoading] = useState(!cachedLeagueIds);

  useEffect(() => {
    let active = true;

    fetchManageableLeagueIds()
      .then((ids) => {
        if (active) setLeagueIds(ids);
      })
      .catch(() => {
        // Si falla, simplemente no se le atribuye al usuario ninguna liga
        // gestionable: sigue viendo el torneo, solo sin los controles de
        // organizador que dependan de una liga (el creador directo no se ve
        // afectado).
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { leagueIds, loading };
};

export default useManageableLeagues;
