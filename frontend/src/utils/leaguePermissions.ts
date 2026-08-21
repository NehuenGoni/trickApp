import { CurrentUser, isAdminRole } from '../hooks/useCurrentUser';

/**
 * Espejo de `canManageLeague` del backend
 * (`backend/src/utils/leaguePermissions.ts`): admin/superadmin, el
 * `createdBy` de la liga, o uno de sus `organizers`. Mantené ambos en sync
 * si cambia la regla.
 *
 * `organizers` acepta tanto IDs planos (`League`, la forma sin poblar) como
 * objetos `{ _id }` (`LeagueWithOrganizers`, como llega poblado en
 * `GET /leagues/:id`), para no forzar un mapeo en cada call site.
 */
export const canManageLeague = (
  user: CurrentUser | null,
  league: { createdBy: string; organizers?: Array<string | { _id: string }> }
): boolean =>
  isAdminRole(user?.role) ||
  (!!user &&
    (league.createdBy === user._id ||
      (league.organizers ?? []).some((o) => (typeof o === 'string' ? o : o._id) === user._id)));

/** Crear una liga nueva sigue siendo solo de admins (espejo de `canManageLeagues`). */
export const canManageLeagues = (user: CurrentUser | null): boolean => isAdminRole(user?.role);
