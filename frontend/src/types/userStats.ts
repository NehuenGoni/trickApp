// Espejo manual del contrato de backend/src/utils/userStats.ts.
// Mismo criterio que types/league.ts, que replica LeagueStandingRow.

export interface UserStatsSplit {
  played: number;
  wins: number;
  losses: number;
  /** 0..1. */
  winRate: number;
}

export interface UserStatsStreak {
  type: 'win' | 'loss' | 'none';
  count: number;
}

export interface UserStatsOverview extends UserStatsSplit {
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
  currentStreak: UserStatsStreak;
  bestWinStreak: number;
  worstLossStreak: number;
  byType: { friendly: UserStatsSplit; tournament: UserStatsSplit };
  unfinishedMatches: number;
  discardedMatches: number;
}

/** Misma forma para compañero y rival: una sola tabla en el front. */
export interface UserStatsPeerRow {
  key: string;
  displayName: string;
  userId: string | null;
  isGuest: boolean;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface UserTournamentResult {
  tournamentId: string;
  name: string;
  type: string;
  format: string;
  startDate: string;
  position: number;
  points: number;
}

export interface UserTournamentTrajectory {
  tournamentsPlayed: number;
  wins: number;
  podiums: number;
  bestPosition: number | null;
  totalPoints: number;
  pointsFromTournaments: number;
  globalRank: number | null;
  globalRankOutOf: number;
  recent: UserTournamentResult[];
}

export interface UserRecentFormEntry {
  matchId: string;
  date: string;
  result: 'win' | 'loss';
  scoreFor: number;
  scoreAgainst: number;
  type: string;
  opponents: string[];
}

export interface UserActivityMonth {
  month: string;
  played: number;
  wins: number;
  losses: number;
}

export interface UserStatsSummary {
  userId: string;
  username: string;
  overview: UserStatsOverview;
  partners: UserStatsPeerRow[];
  rivals: UserStatsPeerRow[];
  bestPartner: UserStatsPeerRow | null;
  nemesis: UserStatsPeerRow | null;
  favouriteVictim: UserStatsPeerRow | null;
  tournaments: UserTournamentTrajectory;
  recentForm: UserRecentFormEntry[];
  activity: UserActivityMonth[];
  meta: {
    minPlayedTogether: number;
    partnersBelowThreshold: number;
    rivalsBelowThreshold: number;
    matchesScanned: number;
    truncated: boolean;
    generatedAt: string;
  };
}

export interface UserMatchPlayer {
  playerId?: string;
  username?: string;
  isGuest?: boolean;
}

export interface UserMatchTeam {
  teamId: string;
  score: number;
  players: UserMatchPlayer[];
}

export interface UserMatch {
  _id: string;
  teams: UserMatchTeam[];
  winner?: string;
  losingTeam?: string;
  status: 'pending' | 'in_progress' | 'finished';
  type: 'friendly' | 'tournament';
  tournament?: string;
  createdAt: string;
}

export interface UserMatchesPage {
  matches: UserMatch[];
  total: number;
  skip: number;
  limit: number;
}
