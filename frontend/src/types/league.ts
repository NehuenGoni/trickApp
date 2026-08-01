import { TournamentLogoMeta, TournamentStatus } from './tournament';

export interface League {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdBy: string;
  logo?: TournamentLogoMeta | null;
  createdAt: string;
  updatedAt: string;
}

/** `League` + contadores que arma `getLeagues` para la lista. */
export interface LeagueListItem extends League {
  tournamentCount: number;
  completedCount: number;
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
  league: League;
  tournaments: LeagueTournamentSummary[];
  standings: LeagueStandingRow[];
  tournamentsCounted: number;
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
