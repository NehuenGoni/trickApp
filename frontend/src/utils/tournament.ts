// Labels y orden de fases del bracket, compartidos entre TournamentDetails
// (vista de administración) y la vista de transmisión en vivo (/live/:id).

/**
 * Clave para comparar un jugador entre el pool de inscriptos y los equipos.
 * Preferimos `signupId`; los torneos ya sorteados antes de esta feature no lo
 * tienen, así que caemos a `playerId` y, para invitados legacy, al nombre
 * normalizado. Espejo de `playerKey` en `backend/src/utils/roster.ts`.
 */
export const playerKey = (p: { signupId?: string; playerId?: string; name: string }): string => {
  if (p.signupId) return `s:${p.signupId}`;
  if (p.playerId) return `u:${p.playerId}`;
  return `g:${p.name.trim().toLowerCase()}`;
};

export const PHASE_LABELS: Record<string, string> = {
  'quarter-finals': 'Cuartos de Final',
  'semifinals-gold': 'Semifinales de Oro',
  'semifinals': 'Semifinales de Plata',
  'final-gold': 'Final Oro',
  'final': 'Final Plata',
  'third-place': 'Match por 3°/4° puesto',
  'seventh-place': 'Match por 7°/8° puesto'
};

export const PHASE_ORDER = [
  'quarter-finals',
  'semifinals-gold',
  'semifinals',
  'final-gold',
  'final',
  'third-place',
  'seventh-place'
];

// Orden fijo de la llave: 8 equipos, 12 partidos siempre en estos slots.
// Usado por la escena de bracket de la vista en vivo para dibujar la llave
// de forma determinística sin depender de en qué orden llegaron los partidos.
export const BRACKET_SLOT_ORDER = [
  'QF1', 'QF2', 'QF3', 'QF4',
  'SFG1', 'SFG2', 'SFS1', 'SFS2',
  'FG', 'FS', 'M34', 'M78'
] as const;

export const BRACKET_SLOT_LABELS: Record<string, string> = {
  QF1: 'Cuartos 1', QF2: 'Cuartos 2', QF3: 'Cuartos 3', QF4: 'Cuartos 4',
  SFG1: 'Semifinal de Oro 1', SFG2: 'Semifinal de Oro 2',
  SFS1: 'Semifinal de Plata 1', SFS2: 'Semifinal de Plata 2',
  FG: 'Final de Oro', FS: 'Final de Plata',
  M34: 'Puesto 3°/4°', M78: 'Puesto 7°/8°'
};

// Los 4 partidos que cierran cada rama: todo equipo juega exactamente 3
// partidos y el tercero es siempre uno de estos, así que perder acá (y solo
// acá) significa quedar afuera con una posición ya definida.
// Espejo de TERMINAL_SLOTS en backend/src/controllers/match.controller.ts.
export const TERMINAL_SLOTS = ['FG', 'FS', 'M34', 'M78'];

// Posición final 1..8 que otorga cada partido terminal.
// Espejo de positionFromMatch() en backend/src/controllers/tournament.controller.ts.
export const SLOT_TO_POSITION: Record<string, { winner: number; loser: number }> = {
  FG: { winner: 1, loser: 2 },
  M34: { winner: 3, loser: 4 },
  FS: { winner: 5, loser: 6 },
  M78: { winner: 7, loser: 8 }
};

// Qué tan "arriba" llegó un equipo, para ordenarlo mientras el torneo corre:
// menor rank = mejor rama. Los cuartos van últimos porque desde ahí todavía
// se puede terminar en cualquier puesto.
export const SLOT_RANK: Record<string, number> = {
  FG: 0,
  M34: 1,
  SFG1: 2, SFG2: 2,
  FS: 3,
  M78: 4,
  SFS1: 5, SFS2: 5,
  QF1: 6, QF2: 6, QF3: 6, QF4: 6
};

// Color de rama de cada partido, para que en la llave se distinga de un
// vistazo el camino de oro del de plata y los partidos por puesto.
// Los cuartos quedan neutros: ahí todavía no hay rama definida.
const GOLD = { accent: '#FFD54F', bg: 'rgba(212,175,55,0.24)', border: 'rgba(212,175,55,0.55)' };
const SILVER = { accent: '#C0C0C0', bg: 'rgba(192,192,192,0.22)', border: 'rgba(192,192,192,0.5)' };
const BRONZE = { accent: '#CD7F32', bg: 'rgba(205,127,50,0.12)', border: 'rgba(205,127,50,0.32)' };
const SLATE = { accent: '#78909C', bg: 'rgba(120,144,156,0.12)', border: 'rgba(120,144,156,0.30)' };
const NEUTRAL = { accent: '#CED4DA', bg: 'rgba(30,45,61,1)', border: 'rgba(255,255,255,0.08)' };

export interface SlotTheme {
  accent: string;
  bg: string;
  border: string;
}

export const BRACKET_SLOT_THEME: Record<string, SlotTheme> = {
  QF1: NEUTRAL, QF2: NEUTRAL, QF3: NEUTRAL, QF4: NEUTRAL,
  SFG1: GOLD, SFG2: GOLD, FG: GOLD,
  SFS1: SILVER, SFS2: SILVER, FS: SILVER,
  M34: BRONZE,
  M78: SLATE
};

export const getSlotTheme = (slot?: string): SlotTheme =>
  (slot && BRACKET_SLOT_THEME[slot]) || NEUTRAL;

// Shape mínimo que necesitan los helpers de foco. Es compatible por estructura
// con la interface Match de TournamentDetails, así que los genéricos de abajo
// devuelven el tipo original del que llama sin necesidad de castear.
export interface FocusableMatch {
  _id: string;
  phase: string;
  status: string;
  bracketSlot?: string;
  teams: Array<{ players: Array<{ playerId?: string }> }>;
}

// Los invitados no tienen playerId, así que nunca matchean: para ellos el
// resultado es false, que es lo correcto (no pueden abrir el scoreboard).
export const isPlayerInMatch = (match: FocusableMatch, userId: string): boolean =>
  !!userId && match.teams.some((t) => t.players.some((p) => p.playerId === userId));

// Partido al que hay que llevar la atención del usuario al abrir el torneo.
// Ojo: in_progress significa "tiene los 2 equipos y está habilitado", no
// "se está jugando ahora", así que puede haber varias fases activas a la vez
// (semis de oro y de plata en paralelo). Desempate: primero el partido propio,
// después la rama más avanzada.
export const findFocusMatch = <T extends FocusableMatch>(
  matches: T[],
  userId: string
): T | null => {
  const live = matches.filter((m) => m.status === 'in_progress');
  if (live.length === 0) return null;
  const mine = live.filter((m) => isPlayerInMatch(m, userId));
  const pool = mine.length > 0 ? mine : live;
  const rank = (m: T) => SLOT_RANK[m.bracketSlot || ''] ?? 99;
  return [...pool].sort((a, b) => rank(a) - rank(b))[0];
};
