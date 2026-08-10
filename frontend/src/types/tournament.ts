/**
 * Metadata del logo de un torneo. El binario se pide aparte a
 * `API_ROUTES.TOURNAMENTS.LOGO(id, version)`; acá viaja solo lo necesario para
 * saber si hay imagen y armar la URL con cache buster.
 *
 * El tipo `Tournament` está duplicado en varias vistas con campos distintos
 * (TournamentList, TournamentDetails, AdminTournaments, useLiveTournament).
 * Este módulo existe para que al menos el logo se declare en un solo lugar.
 */
export interface TournamentLogoMeta {
  version: string;
  mimeType: string;
  size: number;
}

/** Forma mínima que necesita `<TournamentLogo />` para renderizar. */
export interface TournamentLogoSource {
  _id: string;
  name: string;
  logo?: TournamentLogoMeta | null;
}

/**
 * Reescrito como literal en varias vistas (TournamentList, TournamentDetails,
 * AdminTournaments, useLiveTournament); se centraliza acá para nuevo código.
 * Debe reflejar el enum de `backend/src/models/Tournament.ts`.
 */
export type TournamentStatus = 'upcoming' | 'in_progress' | 'completed';

/**
 * Cómo se arman los equipos. Debe reflejar `TEAM_FORMATION_MODES` de
 * `backend/src/config/constants.ts`.
 * - `user-formed`: cada jugador inscribe su equipo ya armado.
 * - `random`: inscripción individual + sorteo.
 * - `creator-formed`: inscripción individual (igual que random) pero los
 *   equipos los arma a mano el creador del torneo.
 */
export type TeamFormationMode = 'user-formed' | 'random' | 'creator-formed';

export const TEAM_FORMATION_LABELS: Record<TeamFormationMode, string> = {
  'user-formed': 'Armados por jugadores',
  random: 'Aleatorios',
  'creator-formed': 'Armados por el creador'
};

/**
 * Modos en los que la inscripción es individual y `individualSignups` es la
 * fuente de verdad de quién está en el torneo: los equipos derivan de ese
 * pool (sorteados en `random`, armados a mano en `creator-formed`), así que
 * sus jugadores no se cuentan aparte al calcular cupos.
 * Espejo de `POOL_BASED_FORMATION_MODES` en `backend/src/config/constants.ts`.
 */
export const poolBasedMode = (mode: TeamFormationMode): boolean => mode !== 'user-formed';
