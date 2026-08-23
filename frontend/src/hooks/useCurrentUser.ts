import { useState, useEffect } from 'react';
import API_ROUTES, { apiRequest } from '../config/api';

export type UserRole = 'user' | 'admin' | 'superadmin';

export interface NotificationPrefs {
  tournamentSignup: boolean;
  tournamentStart: boolean;
  tournamentResults: boolean;
  matchResults: boolean;
  leagueRoles: boolean;
  leagueCapReached: boolean;
}

export interface CurrentUser {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  totalPoints: number;
  emailVerified: boolean;
  notificationPrefs: NotificationPrefs;
}

// El perfil se pide en varias pantallas (NavBar, guardas de ruta, panel).
// Se cachea en memoria para no repetir el fetch en cada montaje.
let cachedUser: CurrentUser | null = null;
let inFlight: Promise<CurrentUser> | null = null;

const fetchCurrentUser = async (): Promise<CurrentUser> => {
  if (cachedUser) return cachedUser;
  if (!inFlight) {
    inFlight = apiRequest(API_ROUTES.AUTH.PROFILE)
      .then((data) => {
        cachedUser = data.user as CurrentUser;
        return cachedUser;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};

/** Invalida el cache tras cambiar el perfil o cerrar sesión. */
export const clearCurrentUserCache = () => {
  cachedUser = null;
};

export const isAdminRole = (role?: UserRole): boolean =>
  role === 'admin' || role === 'superadmin';

export const useCurrentUser = () => {
  const [user, setUser] = useState<CurrentUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetchCurrentUser()
      .then((data) => {
        if (active) setUser(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Error al cargar el perfil');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    user,
    loading,
    error,
    isAdmin: isAdminRole(user?.role),
    isSuperAdmin: user?.role === 'superadmin'
  };
};

export default useCurrentUser;
