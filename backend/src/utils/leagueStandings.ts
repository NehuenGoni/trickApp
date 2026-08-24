import mongoose from "mongoose";
import TournamentModel, { IPlayerStat } from "../models/Tournament";
import User from "../models/User";
import { playerIdentityKey } from "./playerIdentity";

export interface LeagueStandingRow {
  /** "user:<id>" para registrados, "guest:<nombre normalizado>" para invitados. */
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

export interface LeagueStandings {
  standings: LeagueStandingRow[];
  tournamentsCounted: number;
  guestCount: number;
}

interface Accumulator {
  key: string;
  displayName: string;
  userId: string | null;
  isGuest: boolean;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  podiums: number;
  bestPosition: number;
}

/**
 * Identidad de un participante para agrupar puntos entre torneos. Ver
 * utils/playerIdentity.ts para el criterio (registrados por playerId,
 * invitados por nombre normalizado) y sus limitaciones conocidas.
 *
 * Los invitados no suman al ranking global (`awardTournamentPoints` los
 * excluye) pero la liga es su propia competencia y a propósito no usa esa
 * misma regla: acá SÍ suman.
 */
const statKey = (s: IPlayerStat): string => playerIdentityKey(s);

export const computeLeagueStandings = async (
  leagueId: mongoose.Types.ObjectId | string
): Promise<LeagueStandings> => {
  const tournaments = await TournamentModel.find({ league: leagueId, status: "completed" })
    .select("playerStats startDate")
    .sort({ startDate: 1 })
    .lean();

  const acc = new Map<string, Accumulator>();

  for (const t of tournaments) {
    for (const s of t.playerStats ?? []) {
      if (s.isGuest && !s.name?.trim()) continue;
      const key = statKey(s as IPlayerStat);
      if (key === "guest:") continue;

      let row = acc.get(key);
      if (!row) {
        row = {
          key,
          // Primera grafía vista (los torneos están ordenados por fecha):
          // suele ser la original y es determinista.
          displayName: s.isGuest ? s.name : s.name,
          userId: !s.isGuest && s.playerId ? s.playerId.toString() : null,
          isGuest: !!s.isGuest,
          points: 0,
          tournamentsPlayed: 0,
          wins: 0,
          podiums: 0,
          bestPosition: Infinity
        };
        acc.set(key, row);
      }

      row.points += s.points;
      row.tournamentsPlayed += 1;
      if (s.position === 1) row.wins += 1;
      if (s.position <= 3) row.podiums += 1;
      if (s.position < row.bestPosition) row.bestPosition = s.position;
    }
  }

  // Completar el nombre de los usuarios registrados con el username actual
  // (el que viene en playerStats es una foto del momento del torneo).
  const userIds = [...acc.values()].filter((r) => r.userId).map((r) => r.userId as string);
  if (userIds.length > 0) {
    const users = await User.find({ _id: { $in: userIds } }).select("username").lean();
    const usernameById = new Map(users.map((u) => [u._id.toString(), u.username]));
    for (const row of acc.values()) {
      if (row.userId) {
        // Usuario borrado: se deja el nombre que trae playerStats en vez de
        // inventar una fila fantasma o descartar sus puntos.
        row.displayName = usernameById.get(row.userId) ?? row.displayName;
      }
    }
  }

  const sorted = [...acc.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition;
    return a.displayName.localeCompare(b.displayName);
  });

  const standings: LeagueStandingRow[] = [];
  let lastPoints: number | null = null;
  let lastPosition = 0;
  sorted.forEach((row, index) => {
    // Dense ranking: empate en puntos ⇒ misma posición.
    if (lastPoints === null || row.points !== lastPoints) {
      lastPosition = index + 1;
      lastPoints = row.points;
    }
    standings.push({
      key: row.key,
      position: lastPosition,
      displayName: row.displayName,
      userId: row.userId,
      isGuest: row.isGuest,
      points: row.points,
      tournamentsPlayed: row.tournamentsPlayed,
      wins: row.wins,
      podiums: row.podiums,
      bestPosition: row.bestPosition === Infinity ? 0 : row.bestPosition
    });
  });

  return {
    standings,
    tournamentsCounted: tournaments.length,
    guestCount: standings.filter((r) => r.isGuest).length
  };
};
