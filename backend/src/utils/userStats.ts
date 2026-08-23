import mongoose from "mongoose";
import Match, { IMatch, IMatchPlayer } from "../models/Match";
import TournamentModel, { IPlayerStat } from "../models/Tournament";
import User from "../models/User";
import { playerIdentityKey } from "./playerIdentity";
import {
  USER_STATS_MIN_PLAYED_TOGETHER,
  USER_STATS_TOP_PEERS,
  USER_STATS_MAX_MATCHES_SCAN,
  USER_STATS_ACTIVITY_MONTHS,
  USER_STATS_RECENT_FORM
} from "../config/constants";

export interface UserStatsSplit {
  played: number;
  wins: number;
  losses: number;
  /** 0..1. Es 0 cuando played === 0 (nunca NaN). */
  winRate: number;
}

export interface UserStatsStreak {
  type: "win" | "loss" | "none";
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
  /** pending + in_progress: no entran en ninguna otra métrica. */
  unfinishedMatches: number;
  /** finished pero sin winner válido: dato corrupto/legacy, se excluye del resto. */
  discardedMatches: number;
}

/** Misma forma para compañero y rival: una sola tabla en el front. */
export interface UserStatsPeerRow {
  /** "user:<id>" | "guest:<nombre normalizado>" — mismo esquema que leagueStandings. */
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
  /** users.totalPoints: la fuente de verdad del ranking global. */
  totalPoints: number;
  /** Suma de playerStats.points; si difiere de totalPoints hubo un ajuste manual de admin. */
  pointsFromTournaments: number;
  globalRank: number | null;
  globalRankOutOf: number;
  recent: UserTournamentResult[];
}

export interface UserRecentFormEntry {
  matchId: string;
  date: string;
  result: "win" | "loss";
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
  /** Rival contra el que peor winRate propio se tiene. */
  nemesis: UserStatsPeerRow | null;
  /** Rival contra el que mejor winRate propio se tiene. */
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

export interface UserMatchesPage {
  matches: IMatch[];
  total: number;
  skip: number;
  limit: number;
}

const emptySplit = (): UserStatsSplit => ({ played: 0, wins: 0, losses: 0, winRate: 0 });

const winRateOf = (wins: number, played: number): number => (played === 0 ? 0 : wins / played);

/** Determina "mi equipo" y "el otro" en un match de 2 equipos. Null si no aplica. */
const splitTeams = (match: IMatch, userId: string) => {
  if (!match.teams || match.teams.length !== 2) return null;
  const myTeamIndex = match.teams.findIndex((t) =>
    t.players?.some((p) => p.playerId?.toString() === userId)
  );
  if (myTeamIndex === -1) return null;
  const myTeam = match.teams[myTeamIndex];
  const otherTeam = match.teams[myTeamIndex === 0 ? 1 : 0];
  return { myTeam, otherTeam };
};

const monthKeyUTC = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const localeCompareEs = (a: string, b: string) => a.localeCompare(b, "es");

interface PeerAccumulator {
  key: string;
  displayName: string;
  userId: string | null;
  isGuest: boolean;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

const toPeerRow = (acc: PeerAccumulator): UserStatsPeerRow => ({
  key: acc.key,
  displayName: acc.displayName,
  userId: acc.userId,
  isGuest: acc.isGuest,
  played: acc.played,
  wins: acc.wins,
  losses: acc.losses,
  winRate: winRateOf(acc.wins, acc.played),
  pointsFor: acc.pointsFor,
  pointsAgainst: acc.pointsAgainst
});

const accumulatePeer = (
  map: Map<string, PeerAccumulator>,
  player: IMatchPlayer,
  won: boolean,
  pointsFor: number,
  pointsAgainst: number
) => {
  const key = playerIdentityKey({ playerId: player.playerId, name: player.username, isGuest: player.isGuest });
  if (key === "guest:") return; // invitado sin nombre: no crear fila fantasma

  let acc = map.get(key);
  if (!acc) {
    acc = {
      key,
      displayName: player.username ?? "Jugador",
      userId: !player.isGuest && player.playerId ? player.playerId.toString() : null,
      isGuest: !!player.isGuest,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0
    };
    map.set(key, acc);
  }
  acc.played += 1;
  if (won) acc.wins += 1;
  else acc.losses += 1;
  acc.pointsFor += pointsFor;
  acc.pointsAgainst += pointsAgainst;
};

const sortPeers = (rows: UserStatsPeerRow[], by: "winRate" | "played"): UserStatsPeerRow[] =>
  [...rows].sort((a, b) => {
    if (by === "winRate") {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.played !== a.played) return b.played - a.played;
      if (b.pointsFor - b.pointsAgainst !== a.pointsFor - a.pointsAgainst) {
        return b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);
      }
      return localeCompareEs(a.displayName, b.displayName);
    }
    if (b.played !== a.played) return b.played - a.played;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return localeCompareEs(a.displayName, b.displayName);
  });

interface ComputeOptions {
  minPlayedTogether?: number;
}

/**
 * Calcula el resumen de estadísticas de un usuario en JS, sobre partidos
 * traídos con `.find().lean()`. No usa `aggregate()`: la identidad de
 * invitado (normalizeGuestName) hace `.normalize("NFD")`, que Mongo no puede
 * replicar en un pipeline sin una cadena frágil de $replaceAll — y el volumen
 * (cientos de partidos por usuario) no lo justifica. Ver utils/leagueStandings.ts
 * para el mismo patrón aplicado a torneos de una liga.
 */
export const computeUserStats = async (
  userId: string,
  opts: ComputeOptions = {}
): Promise<UserStatsSummary> => {
  const minPlayedTogether = opts.minPlayedTogether ?? USER_STATS_MIN_PLAYED_TOGETHER;

  const [matches, tournaments, user, totalUsers] = await Promise.all([
    Match.find({ "teams.players.playerId": userId })
      .select("teams winner status type createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(USER_STATS_MAX_MATCHES_SCAN)
      .lean(),
    TournamentModel.find({ status: "completed", "playerStats.playerId": userId })
      .select("name type format startDate playerStats")
      .sort({ startDate: -1 })
      .lean(),
    User.findById(userId).select("username totalPoints").lean(),
    User.countDocuments({})
  ]);

  const username = user?.username ?? "Jugador";
  const truncated = matches.length >= USER_STATS_MAX_MATCHES_SCAN;

  // Orden cronológico ascendente para rachas y actividad (createdAt desc arriba,
  // desempatado por _id porque los 12 partidos de un bracket comparten timestamp).
  const chronological = [...matches].reverse();

  let unfinishedMatches = 0;
  let discardedMatches = 0;

  const overview: UserStatsOverview = {
    ...emptySplit(),
    pointsFor: 0,
    pointsAgainst: 0,
    pointsDiff: 0,
    avgPointsFor: 0,
    avgPointsAgainst: 0,
    currentStreak: { type: "none", count: 0 },
    bestWinStreak: 0,
    worstLossStreak: 0,
    byType: { friendly: emptySplit(), tournament: emptySplit() },
    unfinishedMatches: 0,
    discardedMatches: 0
  };

  const partnersMap = new Map<string, PeerAccumulator>();
  const rivalsMap = new Map<string, PeerAccumulator>();
  const recentForm: UserRecentFormEntry[] = [];

  // Pre-sembrar los últimos N meses en 0 ANTES del loop, para que el gráfico
  // no tenga huecos y para que el loop tenga dónde acumular cada partido.
  const now = new Date();
  const activityByMonth = new Map<string, UserActivityMonth>();
  for (let i = USER_STATS_ACTIVITY_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKeyUTC(d);
    activityByMonth.set(key, { month: key, played: 0, wins: 0, losses: 0 });
  }

  let runStreakType: "win" | "loss" | "none" = "none";
  let runStreakCount = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;

  for (const match of chronological) {
    if (match.status === "pending" || match.status === "in_progress") {
      unfinishedMatches += 1;
      continue;
    }
    if (match.status !== "finished") continue;

    const split = splitTeams(match as IMatch, userId);
    if (!split) {
      discardedMatches += 1;
      continue;
    }
    const { myTeam, otherTeam } = split;
    if (!match.winner) {
      discardedMatches += 1;
      continue;
    }
    const winnerStr = match.winner.toString();
    const won = winnerStr === myTeam.teamId.toString();
    const isValidWinner = won || winnerStr === otherTeam.teamId.toString();
    if (!isValidWinner) {
      discardedMatches += 1;
      continue;
    }

    const pointsFor = myTeam.score ?? 0;
    const pointsAgainst = otherTeam.score ?? 0;

    overview.played += 1;
    if (won) overview.wins += 1;
    else overview.losses += 1;
    overview.pointsFor += pointsFor;
    overview.pointsAgainst += pointsAgainst;

    const typeSplit = match.type === "friendly" ? overview.byType.friendly : overview.byType.tournament;
    typeSplit.played += 1;
    if (won) typeSplit.wins += 1;
    else typeSplit.losses += 1;

    // Rachas: se recorre en orden ascendente, así que esta corrida siempre
    // termina siendo la "actual" al llegar al final del loop.
    if (runStreakType === (won ? "win" : "loss")) {
      runStreakCount += 1;
    } else {
      runStreakType = won ? "win" : "loss";
      runStreakCount = 1;
    }
    if (runStreakType === "win") bestWinStreak = Math.max(bestWinStreak, runStreakCount);
    else worstLossStreak = Math.max(worstLossStreak, runStreakCount);

    // Compañeros: el resto de mi equipo. Rivales: todo el equipo contrario.
    const myPlayerKey = playerIdentityKey({ playerId: new mongoose.Types.ObjectId(userId), isGuest: false });
    for (const p of myTeam.players ?? []) {
      const pKey = playerIdentityKey({ playerId: p.playerId, name: p.username, isGuest: p.isGuest });
      if (pKey === myPlayerKey || pKey === "guest:") continue;
      accumulatePeer(partnersMap, p, won, pointsFor, pointsAgainst);
    }
    for (const p of otherTeam.players ?? []) {
      accumulatePeer(rivalsMap, p, won, pointsFor, pointsAgainst);
    }

    // Actividad mensual (UTC), solo dentro de la ventana de meses.
    const createdAt = match.createdAt ? new Date(match.createdAt) : new Date();
    const monthKey = monthKeyUTC(createdAt);
    const monthRow = activityByMonth.get(monthKey);
    if (monthRow) {
      monthRow.played += 1;
      if (won) monthRow.wins += 1;
      else monthRow.losses += 1;
    }

    // Forma reciente: se arma en orden cronológico y se recorta al final a
    // los últimos N (queda automáticamente ordenada más-reciente-primero).
    recentForm.push({
      matchId: (match._id as mongoose.Types.ObjectId).toString(),
      date: createdAt.toISOString(),
      result: won ? "win" : "loss",
      scoreFor: pointsFor,
      scoreAgainst: pointsAgainst,
      type: match.type,
      opponents: (otherTeam.players ?? []).map((p) => p.username ?? "Jugador")
    });
  }

  overview.currentStreak =
    runStreakCount === 0 ? { type: "none", count: 0 } : { type: runStreakType as "win" | "loss", count: runStreakCount };
  overview.bestWinStreak = bestWinStreak;
  overview.worstLossStreak = worstLossStreak;
  overview.winRate = winRateOf(overview.wins, overview.played);
  overview.byType.friendly.winRate = winRateOf(overview.byType.friendly.wins, overview.byType.friendly.played);
  overview.byType.tournament.winRate = winRateOf(overview.byType.tournament.wins, overview.byType.tournament.played);
  overview.pointsDiff = overview.pointsFor - overview.pointsAgainst;
  overview.avgPointsFor = overview.played === 0 ? 0 : Math.round((overview.pointsFor / overview.played) * 10) / 10;
  overview.avgPointsAgainst =
    overview.played === 0 ? 0 : Math.round((overview.pointsAgainst / overview.played) * 10) / 10;
  overview.unfinishedMatches = unfinishedMatches;
  overview.discardedMatches = discardedMatches;

  // El Map se pobló en orden de inserción (más antiguo → más reciente) al
  // pre-sembrarlo arriba, así que extraerlo directo ya da el orden correcto.
  const activityMonths: UserActivityMonth[] = [...activityByMonth.values()];

  const allPartners = [...partnersMap.values()];
  const allRivals = [...rivalsMap.values()];
  const partnersAboveThreshold = allPartners.filter((p) => p.played >= minPlayedTogether);
  const rivalsAboveThreshold = allRivals.filter((p) => p.played >= minPlayedTogether);

  const partnerRows = sortPeers(partnersAboveThreshold.map(toPeerRow), "winRate").slice(0, USER_STATS_TOP_PEERS);
  const rivalRows = sortPeers(rivalsAboveThreshold.map(toPeerRow), "played").slice(0, USER_STATS_TOP_PEERS);

  // Resolver el username actual de los peers registrados (el username del
  // match es una foto del momento en que se jugó).
  const peerUserIds = [
    ...new Set(
      [...partnerRows, ...rivalRows].filter((r) => r.userId).map((r) => r.userId as string)
    )
  ];
  if (peerUserIds.length > 0) {
    const peerUsers = await User.find({ _id: { $in: peerUserIds } }).select("username").lean();
    const usernameById = new Map(peerUsers.map((u) => [u._id.toString(), u.username]));
    for (const row of [...partnerRows, ...rivalRows]) {
      if (row.userId) row.displayName = usernameById.get(row.userId) ?? row.displayName;
    }
  }

  const winRateRankedRivals = sortPeers(rivalRows, "winRate");
  const bestPartner = partnerRows[0] ?? null;
  const nemesis = winRateRankedRivals.length > 0 ? winRateRankedRivals[winRateRankedRivals.length - 1] : null;
  const favouriteVictim = winRateRankedRivals[0] ?? null;

  // Trayectoria en torneos.
  let tournamentsWins = 0;
  let tournamentsPodiums = 0;
  let bestPosition: number | null = null;
  let pointsFromTournaments = 0;
  const recentTournaments: UserTournamentResult[] = [];
  for (const t of tournaments) {
    const stat = (t.playerStats ?? []).find(
      (s: IPlayerStat) => !s.isGuest && s.playerId?.toString() === userId
    );
    if (!stat) continue;
    if (stat.position === 1) tournamentsWins += 1;
    if (stat.position <= 3) tournamentsPodiums += 1;
    if (bestPosition === null || stat.position < bestPosition) bestPosition = stat.position;
    pointsFromTournaments += stat.points;
    if (recentTournaments.length < 5) {
      recentTournaments.push({
        tournamentId: (t._id as mongoose.Types.ObjectId).toString(),
        name: t.name,
        type: t.type,
        format: t.format,
        startDate: (t.startDate ? new Date(t.startDate) : new Date()).toISOString(),
        position: stat.position,
        points: stat.points
      });
    }
  }

  const totalPoints = user?.totalPoints ?? 0;
  let globalRank: number | null = null;
  let globalRankOutOf = totalUsers;
  if (user) {
    const better = await User.countDocuments({ totalPoints: { $gt: totalPoints } });
    globalRank = better + 1;
  }

  return {
    userId,
    username,
    overview,
    partners: partnerRows,
    rivals: rivalRows,
    bestPartner,
    nemesis,
    favouriteVictim,
    tournaments: {
      tournamentsPlayed: tournaments.length,
      wins: tournamentsWins,
      podiums: tournamentsPodiums,
      bestPosition,
      totalPoints,
      pointsFromTournaments,
      globalRank,
      globalRankOutOf,
      recent: recentTournaments
    },
    recentForm: recentForm.slice(-USER_STATS_RECENT_FORM).reverse(),
    activity: activityMonths,
    meta: {
      minPlayedTogether,
      partnersBelowThreshold: allPartners.length - partnersAboveThreshold.length,
      rivalsBelowThreshold: allRivals.length - rivalsAboveThreshold.length,
      matchesScanned: matches.length,
      truncated,
      generatedAt: new Date().toISOString()
    }
  };
};

export interface UserMatchesPageOptions {
  skip?: number;
  limit?: number;
  status?: string;
  type?: string;
}

/** Listado paginado de partidos de un usuario, con el total para paginar. */
export const getUserMatchesPage = async (
  userId: string,
  opts: UserMatchesPageOptions = {}
): Promise<UserMatchesPage> => {
  const skip = Math.max(0, opts.skip ?? 0);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10));

  const filter: Record<string, unknown> = { "teams.players.playerId": userId };
  if (opts.status) filter.status = opts.status;
  if (opts.type) filter.type = opts.type;

  const [matches, total] = await Promise.all([
    Match.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Match.countDocuments(filter)
  ]);

  return { matches: matches as unknown as IMatch[], total, skip, limit };
};
