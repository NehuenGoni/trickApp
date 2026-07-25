// Constantes y helpers de puntaje de truco compartidos entre el Scoreboard
// (juego de un partido) y la vista de transmisión en vivo (/live/:id), para
// que ambas muestren siempre el mismo "malas/buenas" sincronizado.

export const MAX_SCORE = 30;
export const HALF_SCORE = 15;

export const SCORE_STAGE = {
  malas: { label: 'Malas', color: '#B23A48' },
  buenas: { label: 'Buenas', color: '#2E7D32' },
} as const;

export const getScoreStage = (score: number) =>
  (score <= HALF_SCORE ? SCORE_STAGE.malas : SCORE_STAGE.buenas);

// El score interno sigue siendo 0-30, pero al pasar a "buenas" el contador
// visual vuelve a arrancar de 1 (16 -> 1, ..., 30 -> 15).
export const getDisplayScore = (score: number) =>
  (score <= HALF_SCORE ? score : score - HALF_SCORE);
