/**
 * Identidad de un jugador para agrupar estadísticas entre torneos/partidos.
 *
 * Los usuarios registrados se agrupan por `playerId`, que es estable. Los
 * invitados no tienen cuenta, así que se agrupan por nombre normalizado: es
 * una aproximación con dos limitaciones conocidas y aceptadas — dos personas
 * distintas con el mismo nombre se fusionan en una fila, y la misma persona
 * anotada con variantes del nombre ("Juan" / "Juan P.") genera filas
 * separadas.
 *
 * Extraído de utils/leagueStandings.ts para que utils/userStats.ts use
 * exactamente el mismo criterio de agrupación — dos normalizadores
 * independientes divergirían con el tiempo.
 */

/** trim → minúsculas → sin acentos → espacios colapsados. */
export const normalizeGuestName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas combinantes (acentos, tildes)
    .replace(/\s+/g, " ");

/** Cualquier forma de jugador con playerId opcional, nombre e isGuest. */
export interface IdentifiablePlayer {
  playerId?: { toString(): string } | string | null;
  name?: string;
  isGuest?: boolean;
}

/**
 * "user:<id>" para registrados, "guest:<nombre normalizado>" para invitados.
 * Devuelve "guest:" (clave vacía) si el invitado no tiene nombre — el
 * llamador debe saltear esa fila en vez de crear una fantasma.
 */
export const playerIdentityKey = (p: IdentifiablePlayer): string =>
  !p.isGuest && p.playerId
    ? `user:${p.playerId.toString()}`
    : `guest:${normalizeGuestName(p.name ?? "")}`;
