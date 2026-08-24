import { POINTS_TABLE } from "../config/constants";

type TournamentPointsType = keyof typeof POINTS_TABLE;

/**
 * Cuánto más vale un torneo grande. Continua en vez de una tabla para no tener
 * que decidir un valor a mano por cada tamaño posible (4..32): 8 equipos → ×1
 * (la tabla de siempre, sin cambios), 16 → ×1.5, 32 → ×2. Los tamaños
 * intermedios (p. ej. 14) quedan interpolados de forma consistente en vez de
 * saltar de golpe entre escalones.
 */
export const sizeMultiplier = (n: number): number => 1 + 0.5 * Math.log2(n / 8);

/**
 * Redondeo consistente para no repartir puntos como "7.3": los puntos son
 * siempre un número entero. Con N=8 el multiplicador da exactamente 1 y la
 * interpolación da la posición entera de siempre, así que acá no hay
 * redondeo que mueva el número.
 */
const roundPoints = (x: number): number => Math.round(x);

/**
 * Puntos que otorga terminar en la posición `position` de un torneo de `n`
 * equipos y tipo `type`. La curva de referencia es siempre la tabla de 8
 * (`POINTS_TABLE`): la posición real se reescala a esa curva de 1..8 por
 * interpolación lineal y después se multiplica por `sizeMultiplier(n)`.
 *
 * Con n = 8, `basePos` da exactamente `position` (mapeo identidad) y el
 * multiplicador da exactamente 1: el resultado es la tabla actual, valor por
 * valor. Es el invariante que garantiza que esto es una generalización, no un
 * cambio de comportamiento para los torneos que ya existen.
 */
export const pointsForPosition = (
  type: string,
  position: number,
  n: number
): number => {
  const table = POINTS_TABLE[type as TournamentPointsType];
  if (!table) return 0;
  if (n <= 1) return 0;

  const basePos = n === 8 ? position : 1 + ((position - 1) * 7) / (n - 1);
  const lower = Math.max(1, Math.min(8, Math.floor(basePos)));
  const upper = Math.max(1, Math.min(8, Math.ceil(basePos)));
  const lowerPoints = table[lower as keyof typeof table] ?? 0;
  const upperPoints = table[upper as keyof typeof table] ?? 0;
  const fraction = basePos - lower;
  const interpolated =
    lower === upper ? lowerPoints : lowerPoints + (upperPoints - lowerPoints) * fraction;

  return roundPoints(interpolated * sizeMultiplier(n));
};
