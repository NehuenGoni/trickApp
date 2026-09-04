// Labels y orden de fases del bracket, compartidos entre TournamentDetails
// (vista de administración) y la vista de transmisión en vivo (/live/:id).
//
// El torneo ya no es siempre de 8 equipos: `numberOfTeams` (backend
// `models/Tournament.ts`) puede ser cualquier valor entre 4 y 32, y el cuadro
// lo genera `backend/src/utils/bracket.ts`. Para el tamaño de siempre (8) los
// slots siguen llamándose QF1/SFG1/FG/etc. — es un alias legacy que el propio
// backend mantiene a propósito para no romper nada existente. Para cualquier
// otro tamaño, un slot se llama `${puestoMínimo}-${puestoMáximo}#${índice}` y
// se resuelve con la misma matemática acá abajo (espejo de `utils/bracket.ts`
// y `utils/points.ts` del backend).

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

// Orden fijo de la llave de 8 equipos (el tamaño de siempre): 12 partidos
// siempre en estos slots. Para cualquier otro tamaño no hay un orden fijo —
// se arma con `buildBracketRows` a partir de los slots que trajo el torneo.
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

// Los 4 partidos que cierran cada rama del cuadro de 8: todo equipo juega
// exactamente 3 partidos y el tercero es siempre uno de estos, así que perder
// acá (y solo acá) significa quedar afuera con una posición ya definida. Para
// otros tamaños, ver `positionsFromSlot` más abajo — un slot puede decidir un
// solo lado (zona de tamaño impar) o los dos juntos (zona de 2).
export const TERMINAL_SLOTS = ['FG', 'FS', 'M34', 'M78'];

// Posición final 1..8 que otorga cada partido terminal del cuadro de 8.
// Espejo de LEGACY_SLOT_POSITIONS en backend/src/utils/bracket.ts.
export const SLOT_TO_POSITION: Record<string, { winner: number; loser: number }> = {
  FG: { winner: 1, loser: 2 },
  M34: { winner: 3, loser: 4 },
  FS: { winner: 5, loser: 6 },
  M78: { winner: 7, loser: 8 }
};

/** Puesto que otorga cada lado de un partido, o `null` si ese lado sigue en carrera. */
export interface SlotOutcome {
  winner: number | null;
  loser: number | null;
}

/** Mayor potencia de 2 menor que `m`. Espejo de `splitPoint` en backend/src/utils/bracket.ts. */
export const splitPoint = (m: number): number => {
  let p = 1;
  while (p * 2 <= m - 1) p *= 2;
  return p;
};

/**
 * Cantidad total de partidos de un cuadro de `n` equipos. Espejo de
 * `matchCountFor` en backend/src/utils/bracket.ts — se usa en los
 * formularios de creación/edición para mostrar de un vistazo cuánto implica
 * el tamaño elegido, antes de confirmar.
 */
export const matchCountFor = (n: number): number => {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const p = splitPoint(n);
  return n - p + matchCountFor(p) + matchCountFor(n - p);
};

/** Cantidad de rondas del cuadro (la rama más larga): `ceil(log2(n))`. */
export const roundsFor = (n: number): number => Math.ceil(Math.log2(Math.max(n, 2)));

/**
 * Rango de `numberOfTeams` que acepta el formulario. Espejo de
 * `MIN_TOURNAMENT_TEAMS`/`MAX_TOURNAMENT_TEAMS` en backend/src/config/constants.ts.
 */
export const MIN_TOURNAMENT_TEAMS = 4;
export const MAX_TOURNAMENT_TEAMS = 32;
export const TOURNAMENT_TEAMS_PRESETS = [8, 16, 32] as const;

export const isValidNumberOfTeams = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_TOURNAMENT_TEAMS && value <= MAX_TOURNAMENT_TEAMS;

/**
 * Nombres de los cruces de la 1ra ronda del cuadro completo, en el mismo
 * orden y formato que usa el backend al crear los partidos (espejo de
 * `buildBracket` en backend/src/utils/bracket.ts, raíz del árbol). Para 8
 * equipos son los 4 de siempre (QF1..QF4); para cualquier otro tamaño, tantos
 * cruces como `n - splitPoint(n)`.
 */
export const firstRoundSlotsFor = (n: number): string[] => {
  if (n === 8) return ['QF1', 'QF2', 'QF3', 'QF4'];
  const matches = n - splitPoint(n);
  return Array.from({ length: matches }, (_, i) => `1-${n}#${i + 1}`);
};

/** Cuántos equipos no entran en la 1ra ronda y descansan (0 si `n` es potencia de 2). */
export const restingCountFor = (n: number): number => 2 * splitPoint(n) - n;

/** Nombres crudos `${lo}-${hi}#${i}` de todos los partidos de una zona, sin alias legacy. */
const buildZoneSlots = (lo: number, hi: number): string[] => {
  const m = hi - lo + 1;
  if (m <= 1) return [];
  if (m === 2) return [`${lo}-${hi}#1`];
  const p = splitPoint(m);
  const matches = m - p;
  const own = Array.from({ length: matches }, (_, i) => `${lo}-${hi}#${i + 1}`);
  return [...own, ...buildZoneSlots(lo, lo + p - 1), ...buildZoneSlots(lo + p, hi)];
};

/**
 * Todos los slots del cuadro completo de `n` equipos, ANTES de sortear —
 * espejo de `buildBracket(n).nodes` en backend/src/utils/bracket.ts, pero sin
 * la información de qué equipo entra en cada uno (todavía no existe). Sirve
 * para dibujar una vista previa de la llave junto con `buildBracketRows`.
 */
export const previewBracketSlots = (n: number): string[] => {
  const raw = buildZoneSlots(1, n);
  if (n !== 8) return raw;
  const legacy: Record<string, string> = {
    '1-8#1': 'QF1', '1-8#2': 'QF2', '1-8#3': 'QF3', '1-8#4': 'QF4',
    '1-4#1': 'SFG1', '1-4#2': 'SFG2', '5-8#1': 'SFS1', '5-8#2': 'SFS2',
    '1-2#1': 'FG', '3-4#1': 'M34', '5-6#1': 'FS', '7-8#1': 'M78'
  };
  return raw.map((s) => legacy[s] ?? s);
};

/**
 * A partir del orden barajado completo (`draftPairOrder`, largo `n`) separa
 * los cruces de la 1ra ronda (pares consecutivos) de los equipos que
 * descansan (la cola del array) — mismo criterio que usa el backend al armar
 * el cuadro real en `startTournament`.
 */
export const splitDraftOrder = <T,>(order: T[], n: number): { pairs: Array<[T, T]>; resting: T[] } => {
  const matches = n - splitPoint(n);
  const pairs: Array<[T, T]> = [];
  for (let i = 0; i < matches; i++) pairs.push([order[i * 2], order[i * 2 + 1]]);
  return { pairs, resting: order.slice(matches * 2) };
};

/**
 * Puesto que decide cada lado de un slot, derivado únicamente de su nombre —
 * sin depender de ningún dato del torneo. Espejo de `positionsFromSlot` en
 * backend/src/utils/bracket.ts: ver ahí la explicación de por qué en una zona
 * de tamaño impar el perdedor puede quedar decidido solo, sin que el ganador
 * lo esté todavía.
 */
export const positionsFromSlot = (slot: string): SlotOutcome | null => {
  const legacy = SLOT_TO_POSITION[slot];
  if (legacy) return legacy;

  const match = /^(\d+)-(\d+)#(\d+)$/.exec(slot);
  if (!match) return null;
  const lo = Number(match[1]);
  const hi = Number(match[2]);
  const m = hi - lo + 1;
  if (m < 2) return null;
  if (m === 2) return { winner: lo, loser: hi };

  const p = splitPoint(m);
  const matches = m - p;
  return matches === 1 ? { winner: null, loser: hi } : { winner: null, loser: null };
};

/** Rango de puestos que pelea un slot. `null` si el nombre no se puede interpretar. */
const LEGACY_ZONE: Record<string, { posLow: number; posHigh: number; order: number }> = {
  QF1: { posLow: 1, posHigh: 8, order: 1 },
  QF2: { posLow: 1, posHigh: 8, order: 2 },
  QF3: { posLow: 1, posHigh: 8, order: 3 },
  QF4: { posLow: 1, posHigh: 8, order: 4 },
  SFG1: { posLow: 1, posHigh: 4, order: 1 },
  SFG2: { posLow: 1, posHigh: 4, order: 2 },
  SFS1: { posLow: 5, posHigh: 8, order: 1 },
  SFS2: { posLow: 5, posHigh: 8, order: 2 },
  FG: { posLow: 1, posHigh: 2, order: 1 },
  FS: { posLow: 5, posHigh: 6, order: 2 },
  M34: { posLow: 3, posHigh: 4, order: 3 },
  M78: { posLow: 7, posHigh: 8, order: 4 }
};

export const zoneOfSlot = (slot: string): { posLow: number; posHigh: number; order: number } | null => {
  const legacy = LEGACY_ZONE[slot];
  if (legacy) return legacy;
  const match = /^(\d+)-(\d+)#(\d+)$/.exec(slot);
  if (!match) return null;
  return { posLow: Number(match[1]), posHigh: Number(match[2]), order: Number(match[3]) };
};

/** Cuántos equipos pelean el rango de puestos de este slot. Mayor = ronda más temprana. */
export const zoneSizeOfSlot = (slot: string): number => {
  const zone = zoneOfSlot(slot);
  return zone ? zone.posHigh - zone.posLow + 1 : 0;
};

/**
 * Tamaño del cuadro completo y de su "zona de oro" (los puestos 1..P que se
 * arman SIN ningún descanso, ver `splitPoint` / el comentario de cabecera de
 * backend/src/utils/bracket.ts), derivados de los slots presentes — sin
 * necesitar `numberOfTeams` explícito. Sirve para vistas que solo tienen la
 * lista de partidos a mano (la llave en vivo).
 */
export const bracketSizesFromSlots = (slots: string[]): { tournamentSize: number; goldSize: number } => {
  const zones = slots.map(zoneOfSlot).filter((z): z is NonNullable<ReturnType<typeof zoneOfSlot>> => !!z);
  if (zones.length === 0) return { tournamentSize: 0, goldSize: 0 };
  const tournamentSize = Math.max(...zones.map((z) => z.posHigh - z.posLow + 1));
  // La zona de oro es la mayor zona que arranca en el puesto 1 SIN ser la
  // ronda inicial del torneo completo (esa todavía no define ninguna rama).
  const goldCandidates = zones.filter((z) => z.posLow === 1 && z.posHigh - z.posLow + 1 < tournamentSize);
  const goldSize =
    goldCandidates.length > 0 ? Math.max(...goldCandidates.map((z) => z.posHigh - z.posLow + 1)) : tournamentSize;
  return { tournamentSize, goldSize };
};

export type ZoneBadge = 'gold' | 'silver' | null;

/**
 * A qué zona pertenece un partido: "oro" si define un puesto dentro de
 * 1..goldSize, "plata" si define uno más allá — sin importar cuántos niveles
 * de sub-rondas haya adentro de cada zona (p.ej. el partido por el 3°/4°
 * puesto de un cuadro de 8 sigue siendo "de oro": ambos llegaron ahí desde
 * adentro de la zona de oro). `null` en la ronda inicial del cuadro
 * completo, porque ahí todavía no se sabe a qué zona va a ir cada equipo.
 */
export const zoneBadgeForSlot = (slot: string, tournamentSize: number, goldSize: number): ZoneBadge => {
  const zone = zoneOfSlot(slot);
  if (!zone) return null;
  const size = zone.posHigh - zone.posLow + 1;
  if (size >= tournamentSize) return null;
  return zone.posHigh <= goldSize ? 'gold' : 'silver';
};

// Qué tan "arriba" llegó un equipo, para ordenarlo mientras el torneo corre:
// menor rank = mejor rama/más avanzado. Se mantiene como tabla para los
// slots de siempre (8 equipos); `slotRank` de abajo generaliza al resto.
export const SLOT_RANK: Record<string, number> = {
  FG: 0,
  M34: 1,
  SFG1: 2, SFG2: 2,
  FS: 3,
  M78: 4,
  SFS1: 5, SFS2: 5,
  QF1: 6, QF2: 6, QF3: 6, QF4: 6
};

/**
 * Versión general de `SLOT_RANK`: el tamaño de la zona ya ordena
 * correctamente por sí solo (una zona de 2 es más avanzada que una de 4, que
 * a su vez es más avanzada que una de 8), y coincide en dirección con la
 * tabla legacy de arriba. Se usa donde hace falta un ranking que funcione
 * para cualquier `numberOfTeams`, no solo 8.
 */
export const slotRank = (slot?: string): number => {
  if (!slot) return Infinity;
  const legacy = SLOT_RANK[slot];
  if (legacy !== undefined) return legacy;
  const size = zoneSizeOfSlot(slot);
  return size > 0 ? size : Infinity;
};

/** Nombre de ronda genérico según el tamaño de la zona, para tamaños que no son 8. */
const ROUND_LABEL_BY_ZONE_SIZE: Record<number, string> = {
  2: 'Finales',
  4: 'Semifinales',
  8: 'Cuartos de Final',
  16: 'Octavos de Final',
  32: 'Dieciseisavos de Final'
};

export const roundLabelForZoneSize = (size: number): string =>
  ROUND_LABEL_BY_ZONE_SIZE[size] ?? `Ronda inicial (${size} equipos)`;

/** Una fila de la llave, para dibujarla de arriba (ronda más temprana) hacia abajo (finales). */
export interface BracketRow {
  title: string;
  slots: string[];
}

/**
 * Agrupa los slots presentes en un torneo en filas para dibujar la llave:
 * una fila por tamaño de zona (más equipos primero), y dentro de cada fila,
 * ordenados por el rango de puestos que pelean. Para el cuadro de 8 de
 * siempre reproduce el agrupamiento de toda la vida (cuartos / semis /
 * finales); para cualquier otro tamaño lo deriva solo de los nombres de slot.
 */
export const buildBracketRows = (slots: string[]): BracketRow[] => {
  const bySize = new Map<number, string[]>();
  for (const slot of slots) {
    const size = zoneSizeOfSlot(slot);
    if (size <= 0) continue;
    const bucket = bySize.get(size);
    if (bucket) bucket.push(slot);
    else bySize.set(size, [slot]);
  }

  const sizes = Array.from(bySize.keys()).sort((a, b) => b - a);
  return sizes.map((size) => {
    const rowSlots = [...bySize.get(size)!].sort((a, b) => {
      const za = zoneOfSlot(a)!;
      const zb = zoneOfSlot(b)!;
      if (za.posLow !== zb.posLow) return za.posLow - zb.posLow;
      return za.order - zb.order;
    });
    return { title: roundLabelForZoneSize(size), slots: rowSlots };
  });
};

/** Label legible de un slot: el de siempre para los 12 de toda la vida, o uno genérico derivado del rango de puestos. */
export const slotLabel = (slot: string): string => {
  const legacy = BRACKET_SLOT_LABELS[slot];
  if (legacy) return legacy;
  const zone = zoneOfSlot(slot);
  if (!zone) return slot;
  return zone.posHigh === zone.posLow + 1
    ? `Puesto ${zone.posLow}°/${zone.posHigh}°`
    : `Puestos ${zone.posLow}-${zone.posHigh}`;
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

/**
 * Tema de color de un slot. Para los 12 de siempre, la tabla de arriba. Para
 * cualquier otro tamaño: la zona que empieza en el puesto 1 (la que termina
 * peleando el título) va en dorado, una zona chica de tamaño 2 que no es la
 * final va en bronce (son los "partidos por el puesto"), y el resto en
 * plateado — no hay forma de distinguir a simple vista más ramas que esas sin
 * conocer todo el árbol, pero alcanza para que la llave se lea de un vistazo.
 */
export const getSlotTheme = (slot?: string): SlotTheme => {
  if (!slot) return NEUTRAL;
  const legacy = BRACKET_SLOT_THEME[slot];
  if (legacy) return legacy;
  const zone = zoneOfSlot(slot);
  if (!zone) return NEUTRAL;
  if (zone.posLow === 1) return zone.posHigh === 2 ? GOLD : NEUTRAL;
  return zone.posHigh === zone.posLow + 1 ? BRONZE : SILVER;
};

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
  return [...pool].sort((a, b) => slotRank(a.bracketSlot) - slotRank(b.bracketSlot))[0];
};

// Shape mínimo para calcular bloqueadores de una corrección manual: a qué
// partidos alimenta este partido, y si esos ya terminaron.
export interface LinkedMatch {
  _id: string;
  status: string;
  phase: string;
  bracketSlot?: string;
  feedsWinnerTo?: string;
  feedsLoserTo?: string;
}

/**
 * Partidos ya finalizados que cuelgan directo de `match` — espejo de
 * `downstreamBlockers` en `backend/src/services/matchResult.ts`. Vacío =
 * corregir el ganador de `match` no pisa ningún resultado posterior.
 *
 * Es solo para avisar en la UI ANTES de intentar guardar (y para nombrar el
 * partido que hay que deshacer primero): el backend vuelve a validar esto
 * mismo al recibir el pedido, así que una lista desactualizada acá nunca deja
 * pisar nada, en el peor caso solo tarda un request de más en avisar.
 */
export const downstreamBlockers = <T extends LinkedMatch>(match: T, all: T[]): T[] => {
  const targetIds = new Set(
    [match.feedsWinnerTo, match.feedsLoserTo].filter((id): id is string => !!id)
  );
  if (targetIds.size === 0) return [];
  return all.filter((m) => targetIds.has(m._id) && m.status === 'finished');
};
