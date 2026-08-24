import { LiveTournamentData, LivePlayer } from '../../hooks/useLiveTournament';
import { slotLabel, slotRank, positionsFromSlot } from '../../utils/tournament';

export interface TeamRow {
  teamId: string;
  name: string;
  players: LivePlayer[];
  position: number | null; // 1..N si su puesto ya quedó decidido
  points: number | null; // desde standings, según la posición
  state: 'playing' | 'alive' | 'out';
  phaseLabel: string | null; // fase del partido más avanzado del equipo
}

/**
 * Deriva, por equipo, en qué fase está y qué posición final tiene (si ya la
 * tiene) a partir de los matches en vivo. No depende de tournament.playerStats
 * (que guarda una fila por jugador, no por equipo) ni de reglas propias de
 * "eliminación": perder no elimina, baja de zona; el puesto se decide recién
 * cuando `positionsFromSlot` dice que ese LADO (ganador o perdedor, pueden
 * decidirse en momentos distintos en una zona de tamaño impar) ya no sigue.
 */
export const buildTeamRows = (data: LiveTournamentData): TeamRow[] => {
  // Partido más avanzado de cada equipo: el de menor slotRank.
  const bestMatchByTeam = new Map<string, LiveTournamentData['matches'][number]>();
  for (const m of data.matches) {
    if (!m.bracketSlot) continue;
    const rank = slotRank(m.bracketSlot);
    for (const t of m.teams) {
      const current = bestMatchByTeam.get(t.teamId);
      const currentRank = slotRank(current?.bracketSlot);
      if (rank < currentRank) bestMatchByTeam.set(t.teamId, m);
    }
  }

  const pointsByPosition = new Map(data.standings.map((s) => [s.position, s.points]));

  const rows: TeamRow[] = data.teams.map((team) => {
    const match = bestMatchByTeam.get(team.teamId);
    const slot = match?.bracketSlot;

    let position: number | null = null;
    if (slot && match!.status === 'finished' && match!.winner) {
      const outcome = positionsFromSlot(slot);
      const isWinner = match!.winner === team.teamId;
      position = outcome ? (isWinner ? outcome.winner : outcome.loser) : null;
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
      phaseLabel: slot ? slotLabel(slot) : null
    };
  });

  rows.sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;

    const aRank = slotRank(bestMatchByTeam.get(a.teamId)?.bracketSlot);
    const bRank = slotRank(bestMatchByTeam.get(b.teamId)?.bracketSlot);
    if (aRank !== bRank) return aRank - bRank;

    if (a.state === 'playing' && b.state !== 'playing') return -1;
    if (b.state === 'playing' && a.state !== 'playing') return 1;

    return a.name.localeCompare(b.name);
  });

  return rows;
};
