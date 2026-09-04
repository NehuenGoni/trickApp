import { CurrentUser, isAdminRole } from '../hooks/useCurrentUser';

/**
 * Espejo de `canManageTournament` del backend
 * (`backend/src/utils/tournamentAccess.ts`): admin/superadmin, el
 * `createdBy` del torneo, o quien administra la liga a la que pertenece
 * (dueño u organizador — ver `useManageableLeagues`, que ya filtra
 * server-side con ese mismo criterio). Mantené ambos en sync si cambia la
 * regla.
 *
 * Antes la UI solo miraba `createdBy === user._id`: un organizador de liga
 * gestionaba el torneo igual por API (el backend ya lo autorizaba) pero no
 * veía ninguno de los controles en pantalla.
 */
export const canManageTournament = (
  user: CurrentUser | null,
  tournament: { createdBy: string; league?: { _id: string } | null },
  manageableLeagueIds: Set<string>
): boolean =>
  isAdminRole(user?.role) ||
  (!!user &&
    (tournament.createdBy === user._id ||
      (!!tournament.league && manageableLeagueIds.has(tournament.league._id))));
