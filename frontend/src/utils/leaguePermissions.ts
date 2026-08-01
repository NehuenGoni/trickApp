import { CurrentUser, isAdminRole } from '../hooks/useCurrentUser';
import { League } from '../types/league';

/**
 * Espejo de `canManageLeague` del backend
 * (`backend/src/utils/leaguePermissions.ts`): admin/superadmin, o el
 * `createdBy` de la liga. Mantené ambos en sync si cambia la regla.
 */
export const canManageLeague = (
  user: CurrentUser | null,
  league: Pick<League, 'createdBy'>
): boolean => isAdminRole(user?.role) || (!!user && league.createdBy === user._id);

/** Crear una liga nueva sigue siendo solo de admins (espejo de `canManageLeagues`). */
export const canManageLeagues = (user: CurrentUser | null): boolean => isAdminRole(user?.role);
