// El theme de la app es dark-only y no expone variables CSS, así que las
// bandas de fondo de la landing van como constantes tipadas en vez de
// strings sueltos repetidos en cada sección.
export const TONES = {
  felt: '#122620', // background.default — verde paño, tono base
  night: '#0D1B2A', // primary.main — azul noche, banda de contraste
  paper: '#1E2D3D' // background.paper — reservado para cards "elevadas"
} as const;

export type SectionTone = keyof typeof TONES;

export const GOLD = '#FFD700';

/** Halo dorado sutil del hero y del CTA final: gradiente radial, no imagen. */
export const HERO_GLOW =
  `radial-gradient(ellipse 80% 55% at 50% -10%, rgba(255,215,0,0.12), transparent 65%), ${TONES.felt}`;

/** Misma idea pero apoyada a la izquierda, para el bloque de modo TV. */
export const SIDE_GLOW =
  `radial-gradient(ellipse 60% 80% at 0% 50%, rgba(255,215,0,0.09), transparent 60%), ${TONES.felt}`;

/**
 * Variantes sobre `night` de los dos glows de arriba. Existen porque la
 * alternancia felt/night entre secciones no da para que dos secciones con
 * glow (hero y CTA final, o "modo TV") caigan siempre sobre `felt` — a
 * veces el vecino de arriba y de abajo ya son `felt`, y necesitan un glow
 * "night" para no quedar del mismo color que uno de los dos.
 */
export const NIGHT_GLOW =
  `radial-gradient(ellipse 80% 55% at 50% -10%, rgba(255,215,0,0.12), transparent 65%), ${TONES.night}`;

export const NIGHT_SIDE_GLOW =
  `radial-gradient(ellipse 60% 80% at 0% 50%, rgba(255,215,0,0.09), transparent 60%), ${TONES.night}`;

/** Curva de easing consistente para toda animación de entrada de la landing. */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
