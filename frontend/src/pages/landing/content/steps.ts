export interface LandingStep {
  title: string;
  body: string;
}

export const STEPS: LandingStep[] = [
  {
    title: 'Creá el torneo',
    body: 'Elegís el sistema de puntuación, parejas o tríos, y cargás los equipos que tengas esa noche. Podés sortearlos en el momento si nadie vino con compañero.'
  },
  {
    title: 'Cargá los resultados',
    body: 'A medida que terminan los partidos tocás el ganador. La llave avanza sola, los puntos se suman solos y nadie discute.'
  },
  {
    title: 'Proyectalo en la pantalla',
    body: 'Abrís la pantalla en vivo en el proyector o la pantalla del local y el bar entero ve quién está jugando, cómo va la llave y cómo quedó la tabla.'
  }
];

export default STEPS;
