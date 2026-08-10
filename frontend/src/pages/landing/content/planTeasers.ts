import type { PlanId } from '../../../config/plans';

/**
 * Resumen de 3 bullets por plan para la landing — deliberadamente más
 * corto que `planFeatures()` en `frontend/src/pages/billing/Plans.tsx`
 * (una landing no puede mostrar 8 bullets por card). La fuente de verdad
 * de los límites reales es `frontend/src/config/plans.ts`, y la del
 * precio, el backend (`usePricing`) — este archivo solo tiene copy.
 */
export const PLAN_TEASERS: Record<PlanId, string[]> = {
  free: [
    '1 torneo completo, de por vida',
    'Partidos sueltos y contador de truco, siempre gratis',
    'Página pública compartible de ese torneo'
  ],
  basico: ['2 torneos por mes', '1 liga con hasta 40 jugadores', 'Tabla pública compartible'],
  club: [
    '4 torneos por mes',
    '1 liga con hasta 100 jugadores',
    '3 organizadores además de vos, y tu logo en la pantalla en vivo'
  ],
  pro: [
    'Torneos ilimitados',
    '3 ligas, jugadores y organizadores sin tope',
    'Espacio de sponsor en la pantalla en vivo'
  ]
};

export default PLAN_TEASERS;
