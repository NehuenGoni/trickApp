import { TournamentLogoMeta, TournamentStatus } from './tournament';

export interface League {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdBy: string;
  /** IDs de usuario. En la mayoría de los endpoints viene sin poblar. */
  organizers: string[];
  logo?: TournamentLogoMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueOrganizer {
  _id: string;
  username: string;
  email: string;
}

/** Cómo llega `league` en `GET /leagues/:id`: `organizers` viene poblado. */
export interface LeagueWithOrganizers extends Omit<League, 'organizers'> {
  organizers: LeagueOrganizer[];
}

/** `League` + contadores que arma `getLeagues` para la lista. */
export interface LeagueListItem extends League {
  tournamentCount: number;
  completedCount: number;
  /** Participantes únicos (registrados + invitados) de CUALQUIER torneo de la liga. */
  playerCount: number;
  registeredCount: number;
  guestCount: number;
}

/** Jugadores únicos de una liga — mismo criterio en el listado, el detalle y el gate del backend. */
export interface LeaguePlayerCounts {
  playerCount: number;
  registeredCount: number;
  guestCount: number;
}

/**
 * Cómo llega cada torneo dentro del detalle de una liga. Estructuralmente
 * compatible con `TournamentLogoSource` (mismos `_id`/`name`/`logo`) para
 * poder reusar `<TournamentLogo />` sin adaptar nada.
 */
export interface LeagueTournamentSummary {
  _id: string;
  name: string;
  status: TournamentStatus;
  type: string;
  startDate: string;
  logo?: TournamentLogoMeta | null;
}

export interface LeagueStandingRow {
  key: string;
  position: number;
  displayName: string;
  userId: string | null;
  isGuest: boolean;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  podiums: number;
  bestPosition: number;
}

/** Respuesta de `GET /leagues/:id`: todo lo que necesita LeagueDetails en un solo fetch. */
export interface LeagueDetail {
  league: LeagueWithOrganizers;
  tournaments: LeagueTournamentSummary[];
  playerCounts: LeaguePlayerCounts;
  standings: LeagueStandingRow[];
  tournamentsCounted: number;
  /** Invitados EN LA TABLA DE POSICIONES (solo torneos completados) — distinto de `playerCounts.guestCount`. */
  guestCount: number;
}

export interface LeagueFormValues {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/** Cómo llega la liga embebida en un torneo (siempre populada como {_id, name}). */
export type LeagueRef = Pick<League, '_id' | 'name'>;
