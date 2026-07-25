import { LiveTournamentData, LivePlayer } from '../../hooks/useLiveTournament';
import { BRACKET_SLOT_LABELS, SLOT_RANK, SLOT_TO_POSITION, TERMINAL_SLOTS } from '../../utils/tournament';

export interface TeamRow {
  teamId: string;
  name: string;
  players: LivePlayer[];
  position: number | null; // 1..8 si su partido terminal ya terminó
  points: number | null; // desde standings, según la posición
  state: 'playing' | 'alive' | 'out';
  phaseLabel: string | null; // fase del partido más avanzado del equipo
}

/**
 * Deriva, por equipo, en qué fase está y qué posición final tiene (si ya la
 * tiene) a partir de los matches en vivo. No depende de tournament.playerStats
 * (que guarda una fila por jugador, no por equipo) ni de reglas propias de
 * "eliminación": perder en cuartos no elimina, pasa a la semifinal de plata;
 * solo perder un partido terminal (TERMINAL_SLOTS) define el puesto.
 */
export const buildTeamRows = (data: LiveTournamentData): TeamRow[] => {
  // Partido más avanzado de cada equipo: el de menor SLOT_RANK.
  const bestMatchByTeam = new Map<string, LiveTournamentData['matches'][number]>();
  for (const m of data.matches) {
    if (!m.bracketSlot) continue;
    const rank = SLOT_RANK[m.bracketSlot] ?? Infinity;
    for (const t of m.teams) {
      const current = bestMatchByTeam.get(t.teamId);
      const currentRank = current?.bracketSlot ? SLOT_RANK[current.bracketSlot] ?? Infinity : Infinity;
      if (rank < currentRank) bestMatchByTeam.set(t.teamId, m);
    }
  }

  const pointsByPosition = new Map(data.standings.map((s) => [s.position, s.points]));

  const rows: TeamRow[] = data.teams.map((team) => {
    const match = bestMatchByTeam.get(team.teamId);
    const slot = match?.bracketSlot;

    let position: number | null = null;
    if (slot && TERMINAL_SLOTS.includes(slot) && match!.status === 'finished' && match!.winner) {
      const isWinner = match!.winner === team.teamId;
      const map = SLOT_TO_POSITION[slot];
      position = map ? (isWinner ? map.winner : map.loser) : null;
    }

    let state: TeamRow['state'] = 'alive';
    if (match?.status === 'in_progress') state = 'playing';
    else if (position !== null) state = 'out';

    return {
      teamId: team.teamId,
      name: team.name,
      players: team.players,
      position,
      points: position !== null ? pointsByPosition.get(position) ?? null : null,
      state,
      phaseLabel: slot ? BRACKET_SLOT_LABELS[slot] ?? slot : null
    };
  });

  rows.sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;

    const aMatch = bestMatchByTeam.get(a.teamId);
    const bMatch = bestMatchByTeam.get(b.teamId);
    const aRank = aMatch?.bracketSlot ? SLOT_RANK[aMatch.bracketSlot] ?? Infinity : Infinity;
    const bRank = bMatch?.bracketSlot ? SLOT_RANK[bMatch.bracketSlot] ?? Infinity : Infinity;
    if (aRank !== bRank) return aRank - bRank;

    if (a.state === 'playing' && b.state !== 'playing') return -1;
    if (b.state === 'playing' && a.state !== 'playing') return 1;

    return a.name.localeCompare(b.name);
  });

  return rows;
};
