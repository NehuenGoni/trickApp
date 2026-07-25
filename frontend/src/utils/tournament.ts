// Labels y orden de fases del bracket, compartidos entre TournamentDetails
// (vista de administración) y la vista de transmisión en vivo (/live/:id).

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
