import { BRACKET_SLOTS, MATCH_PHASES } from "../config/constants";

/**
 * Generador del cuadro para cualquier cantidad de equipos.
 *
 * El torneo es un bracket de CLASIFICACIÓN COMPLETA: nadie se elimina, el que
 * pierde baja de zona y sigue jugando por el puesto, y al final los N equipos
 * terminan con una posición exacta 1..N (es lo que alimenta `playerStats` y la
 * tabla de la liga).
 *
 * La regla es una sola, sobre una zona de `m` equipos que pelean el rango de
 * puestos [lo, hi]:
 *
 *   P = la mayor potencia de 2 menor que m.
 *   Se juegan `m - P` partidos; los `2P - m` equipos que no entran en esos
 *   cruces DESCANSAN. Los ganadores + los que descansaron forman la zona alta,
 *   de exactamente P equipos; los perdedores forman la zona baja, de `m - P`.
 *   Se repite en cada zona. Caso base m = 2: un único partido que define esas
 *   dos posiciones.
 *
 * Dos propiedades caen solas de esa fórmula y son las que hacen que valga la
 * pena escribirla así:
 *
 *  1. Si m es potencia de 2, P = m/2 y no descansa nadie: mitades iguales.
 *     Aplicada a 8 reproduce EXACTAMENTE los 12 partidos y la topología que
 *     antes vivían hardcodeados en `BRACKET_TEMPLATES`/`FEED_MAP`. El torneo de
 *     8 no es un caso especial acá: es la misma fórmula.
 *  2. La zona alta siempre es potencia de 2, así que la rama que pelea el
 *     título nunca tiene un bye y nadie descansa dos veces (el que descansa
 *     sube justamente a esa zona). La irregularidad queda empujada hacia los
 *     puestos bajos, donde pesa menos.
 *
 * Un "descanso" no necesita ningún concepto nuevo en el modelo: el `loserTo`
 * del partido de origen simplemente apunta a un partido más profundo, salteando
 * una ronda. Para los que descansan en la PRIMERA ronda del torneo no hay
 * partido de origen, así que `startTournament` los precarga en el slot que
 * indica `restEntrySlots`.
 */

export interface BracketNode {
  /** Identificador del partido dentro del torneo. Ver `slotName`. */
  slot: string;
  /** Agrupador para mostrar (todos los partidos de una misma zona lo comparten). */
  phase: string;
  /** Profundidad desde la raíz: 1 = primera ronda del torneo. */
  round: number;
  /** Índice del partido dentro de su zona (0-based). */
  indexInRound: number;
  /** Mejor y peor puesto alcanzable por quienes juegan este partido. */
  posLow: number;
  posHigh: number;
  winnerTo?: string;
  loserTo?: string;
}

export interface BracketPlan {
  nodes: BracketNode[];
  /** Partidos de la primera ronda, en orden. Reciben 2 equipos cada uno. */
  firstRoundSlots: string[];
  /**
   * Slots donde hay que precargar a los equipos que no juegan la primera ronda,
   * en orden. Vacío cuando N es potencia de 2.
   */
  restEntrySlots: string[];
}

/** Mayor potencia de 2 menor o igual a `x`. Sin floats: `Math.log2` de un no-potencia redondea mal. */
const highestPowerOfTwoAtMost = (x: number): number => {
  let p = 1;
  while (p * 2 <= x) p *= 2;
  return p;
};

/**
 * Tamaño de la zona alta de una zona de `m` equipos: la mayor potencia de 2
 * MENOR que `m`. Para m potencia de 2 da m/2 (mitades iguales, sin descansos).
 */
export const splitPoint = (m: number): number => highestPowerOfTwoAtMost(m - 1);

const slotName = (lo: number, hi: number, index: number): string => `${lo}-${hi}#${index}`;
const phaseName = (lo: number, hi: number): string => `z${lo}-${hi}`;

/**
 * Nombres que usaba el cuadro fijo de 8. Se siguen emitiendo para N = 8 (y solo
 * para N = 8) para que los torneos ya jugados, los mails, la vista de TV y los
 * tests existentes no vean ninguna diferencia. No hay migración de datos.
 */
const LEGACY_SLOT: Record<string, string> = {
  "1-8#1": BRACKET_SLOTS.QF1,
  "1-8#2": BRACKET_SLOTS.QF2,
  "1-8#3": BRACKET_SLOTS.QF3,
  "1-8#4": BRACKET_SLOTS.QF4,
  "1-4#1": BRACKET_SLOTS.SFG1,
  "1-4#2": BRACKET_SLOTS.SFG2,
  "5-8#1": BRACKET_SLOTS.SFS1,
  "5-8#2": BRACKET_SLOTS.SFS2,
  "1-2#1": BRACKET_SLOTS.FG,
  "3-4#1": BRACKET_SLOTS.M34,
  "5-6#1": BRACKET_SLOTS.FS,
  "7-8#1": BRACKET_SLOTS.M78
};

const LEGACY_PHASE: Record<string, string> = {
  "z1-8": MATCH_PHASES.QUARTER_FINALS,
  "z1-4": MATCH_PHASES.SEMIFINALS_GOLD,
  "z5-8": MATCH_PHASES.SEMIFINALS,
  "z1-2": MATCH_PHASES.FINAL_GOLD,
  "z3-4": MATCH_PHASES.THIRD_PLACE,
  "z5-6": MATCH_PHASES.FINAL,
  "z7-8": MATCH_PHASES.SEVENTH_PLACE
};

/** Posición final que otorga un slot terminal (el que no alimenta ningún otro partido). */
const LEGACY_SLOT_POSITIONS: Record<string, { winner: number; loser: number }> = {
  [BRACKET_SLOTS.FG]: { winner: 1, loser: 2 },
  [BRACKET_SLOTS.M34]: { winner: 3, loser: 4 },
  [BRACKET_SLOTS.FS]: { winner: 5, loser: 6 },
  [BRACKET_SLOTS.M78]: { winner: 7, loser: 8 }
};

interface ZoneResult {
  nodes: BracketNode[];
  /**
   * Dónde entra cada uno de los `m` equipos que llegan a esta zona, en orden.
   * Los primeros `2 * partidos` son los cruces de su primera ronda (cada slot
   * repetido dos veces, uno por lugar); los últimos son los slots de la ronda
   * siguiente que reciben a los que descansan.
   */
  entrySlots: string[];
}

const buildZone = (lo: number, hi: number, round: number): ZoneResult => {
  const m = hi - lo + 1;
  if (m <= 1) return { nodes: [], entrySlots: [] };

  if (m === 2) {
    const slot = slotName(lo, hi, 1);
    const node: BracketNode = {
      slot,
      phase: phaseName(lo, hi),
      round,
      indexInRound: 0,
      posLow: lo,
      posHigh: hi
    };
    return { nodes: [node], entrySlots: [slot, slot] };
  }

  const p = splitPoint(m);
  const matches = m - p;
  const resting = m - 2 * matches; // = 2p - m

  const high = buildZone(lo, lo + p - 1, round + 1);
  const low = buildZone(lo + p, hi, round + 1);

  const nodes: BracketNode[] = [];
  const entrySlots: string[] = [];

  for (let i = 0; i < matches; i++) {
    const slot = slotName(lo, hi, i + 1);
    nodes.push({
      slot,
      phase: phaseName(lo, hi),
      round,
      indexInRound: i,
      posLow: lo,
      posHigh: hi,
      // El ganador sube a la zona alta y el perdedor baja a la baja, cada uno al
      // lugar `i` de su zona. Como `entrySlots` ya contempla los descansos, un
      // `loserTo` puede apuntar a un partido de una ronda posterior: eso ES el
      // descanso, no hay nada más que modelar.
      winnerTo: high.entrySlots[i],
      loserTo: low.entrySlots[i]
    });
    entrySlots.push(slot, slot);
  }

  // Los que descansan ocupan los lugares de la zona alta que quedaron libres.
  // `matches + resting === p`, así que se consumen exactamente sus `p` entradas.
  for (let k = 0; k < resting; k++) {
    entrySlots.push(high.entrySlots[matches + k]);
  }

  return { nodes: [...nodes, ...high.nodes, ...low.nodes], entrySlots };
};

/**
 * Cuadro completo para `n` equipos. Para n = 8 devuelve los slots y phases
 * legacy, idénticos partido por partido al cuadro fijo que existía antes.
 */
export const buildBracket = (n: number): BracketPlan => {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`Cantidad de equipos inválida para armar el cuadro: ${n}`);
  }

  const root = buildZone(1, n, 1);
  const useLegacy = n === 8;

  const rename = (slot: string | undefined): string | undefined => {
    if (slot === undefined) return undefined;
    return useLegacy ? LEGACY_SLOT[slot] ?? slot : slot;
  };

  const nodes = root.nodes.map((node) => ({
    ...node,
    slot: rename(node.slot)!,
    // n=8: el código legacy (para que MATCH_PHASE_LABELS seguir resolviéndolo
    // igual que siempre). Cualquier otro N: el label en español directo — no
    // hay una tabla de traducción separada que mantener para tamaños nuevos,
    // y los consumidores (mails, frontend) ya tienen que hacer fallback al
    // valor crudo de `phase` para slots que no reconocen.
    phase: useLegacy ? LEGACY_PHASE[node.phase] ?? node.phase : phaseLabelFor(node.posLow, node.posHigh),
    winnerTo: rename(node.winnerTo),
    loserTo: rename(node.loserTo)
  }));

  // La raíz reparte sus equipos igual que cualquier zona: de a dos por cruce y,
  // si sobran, a los slots de descanso. Mantener este orden es lo que hace que
  // `pairOrder[0]` y `pairOrder[1]` sigan enfrentándose en el primer cruce.
  const firstRoundSlots: string[] = [];
  const restEntrySlots: string[] = [];
  const m = n;
  const p = m === 2 ? 1 : splitPoint(m);
  const matches = m === 2 ? 1 : m - p;
  for (let i = 0; i < matches; i++) {
    firstRoundSlots.push(rename(root.entrySlots[i * 2])!);
  }
  for (let i = 2 * matches; i < root.entrySlots.length; i++) {
    restEntrySlots.push(rename(root.entrySlots[i])!);
  }

  return { nodes, firstRoundSlots, restEntrySlots };
};

/**
 * Puesto que otorga cada lado de un partido, si ya está decidido.
 *
 * En un cuadro parejo (potencia de 2) un partido decide siempre los DOS lados
 * a la vez: el que gana sigue a otro partido o no, y el que pierde también,
 * juntos. Pero en una zona de tamaño irregular (3, 5, 9, 17...) puede pasar
 * que el PERDEDOR ya tenga puesto final (queda solo, sin rival, en el fondo de
 * la zona) mientras el GANADOR todavía tiene que seguir jugando para llegar a
 * la zona pareja de arriba. Por eso cada lado es independiente: `winner`/
 * `loser` son `null` cuando ese lado todavía sigue en carrera.
 */
export interface SlotOutcome {
  winner: number | null;
  loser: number | null;
}

/**
 * Deriva de qué zona [lo, hi] es un slot y si cada lado ya define puesto,
 * usando la misma regla de `buildZone`: cuando la zona baja de la partición
 * (`m - p`) queda en exactamente 1 equipo, ese equipo no tiene con quién
 * jugar y su puesto (el `hi` de la zona) queda decidido ahí mismo. La zona
 * alta (`p`) siempre es potencia de 2 y nunca decide antes de tiempo — salvo
 * en el caso base de 2 equipos, donde ambos lados se deciden juntos.
 * No depende de ningún dato del torneo: se recalcula solo del nombre del slot.
 */
export const positionsFromSlot = (slot: string): SlotOutcome | null => {
  const legacy = LEGACY_SLOT_POSITIONS[slot];
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
  // La zona baja de este nivel tiene tamaño `matches` (uno de sus futuros
  // partidos por cada perdedor de acá). Si es 1, ese único integrante no
  // juega más: ya está en el puesto `hi`.
  return matches === 1 ? { winner: null, loser: hi } : { winner: null, loser: null };
};

/** Nombre legible de una zona, para acordeones y mails. */
export const phaseLabelFor = (posLow: number, posHigh: number): string => {
  const m = posHigh - posLow + 1;
  if (m === 2) {
    return posLow === 1 ? "Final" : `Partido por el ${posLow}° puesto`;
  }
  if (posLow === 1) {
    if (m === 4) return "Semifinales";
    if (m === 8) return "Cuartos de final";
    return `Zona de oro (puestos 1-${posHigh})`;
  }
  return `Zona por los puestos ${posLow}-${posHigh}`;
};

/** Cantidad total de partidos de un cuadro de `n` equipos. */
export const matchCountFor = (n: number): number => {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const p = splitPoint(n);
  return n - p + matchCountFor(p) + matchCountFor(n - p);
};
