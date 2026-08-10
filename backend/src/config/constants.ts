export const FRIENDLY_MATCHES_ID = 'friendly_matches';

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
} as const;

export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPERADMIN];

export const MIN_PASSWORD_LENGTH = 6;

/** Vigencia del enlace de recuperación de contraseña. */
export const PASSWORD_RESET_TTL_MINUTES = 60;

/** Vigencia del enlace de confirmación de email. */
export const EMAIL_VERIFICATION_TTL_HOURS = 48;

/**
 * Ventana antes del vencimiento de una suscripción en la que se manda el
 * recordatorio de renovación (ver `POST /billing/cron/reconcile-pending`).
 */
export const EXPIRY_REMINDER_WINDOW_DAYS = { from: 3, to: 4 };

export const MATCH_TYPES = {
  FRIENDLY: 'friendly',
  TOURNAMENT: 'tournament'
} as const;

export const MATCH_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished'
} as const;

export const MATCH_PHASES = {
  QUARTER_FINALS: 'quarter-finals',
  SEMIFINALS_GOLD: 'semifinals-gold',
  SEMIFINALS: 'semifinals',
  FINAL_GOLD: 'final-gold',
  FINAL: 'final',
  THIRD_PLACE: 'third-place',
  SEVENTH_PLACE: 'seventh-place'
} as const;

/** Nombre en español de cada fase, para mensajes al usuario (ej. mails de resultado de partido). */
export const MATCH_PHASE_LABELS: Record<typeof MATCH_PHASES[keyof typeof MATCH_PHASES], string> = {
  [MATCH_PHASES.QUARTER_FINALS]: 'cuartos de final',
  [MATCH_PHASES.SEMIFINALS_GOLD]: 'semifinales (zona oro)',
  [MATCH_PHASES.SEMIFINALS]: 'semifinales',
  [MATCH_PHASES.FINAL_GOLD]: 'la final',
  [MATCH_PHASES.FINAL]: 'la final',
  [MATCH_PHASES.THIRD_PLACE]: 'el partido por el 3er puesto',
  [MATCH_PHASES.SEVENTH_PLACE]: 'el partido por el 7mo puesto'
};

export const BRACKET_SLOTS = {
  QF1: 'QF1',
  QF2: 'QF2',
  QF3: 'QF3',
  QF4: 'QF4',
  SFG1: 'SFG1',
  SFG2: 'SFG2',
  SFS1: 'SFS1',
  SFS2: 'SFS2',
  FG: 'FG',
  FS: 'FS',
  M34: 'M34',
  M78: 'M78'
} as const;

export const TOURNAMENT_TYPES = {
  GRAND_SLAM: 'grand-slam',
  MASTER_1000: 'master-1000'
} as const;

export const TOURNAMENT_FORMATS = {
  DUOS: 'duos',
  TRIOS: 'trios'
} as const;

export const TEAM_FORMATION_MODES = {
  USER_FORMED: 'user-formed',
  RANDOM: 'random',
  CREATOR_FORMED: 'creator-formed'
} as const;

/**
 * Modos en los que la inscripción es individual y `individualSignups` es la
 * fuente de verdad de quién está en el torneo. Los equipos derivan de ese pool
 * (sorteados en `random`, armados a mano en `creator-formed`), así que sus
 * jugadores NO se cuentan aparte al calcular cupos.
 */
export const POOL_BASED_FORMATION_MODES: string[] = [
  TEAM_FORMATION_MODES.RANDOM,
  TEAM_FORMATION_MODES.CREATOR_FORMED
];

export const GUEST_DRAW_MODES = {
  GROUPED: 'grouped',
  MIXED: 'mixed'
} as const;

export const FORMAT_TEAM_SIZE = {
  duos: 2,
  trios: 3
} as const;

export const TOURNAMENT_TEAMS_COUNT = 8;

export const MAX_SCORE = 30;

/**
 * Límites del logo de torneo.
 * El cliente redimensiona a 512px WebP antes de subir (~45 KB), así que 300 KB
 * deja margen de sobra y a la vez corta cualquier intento de subir el original.
 */
export const MAX_LOGO_BYTES = 300 * 1024;

/** Tope de ancho/alto, validado leyendo el header sin decodificar la imagen. */
export const MAX_LOGO_DIMENSION = 1024;

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/webp',
  'image/png',
  'image/jpeg'
] as const;

export type AllowedLogoMimeType = typeof ALLOWED_LOGO_MIME_TYPES[number];

export const POINTS_TABLE = {
  'grand-slam': {
    1: 25,
    2: 18,
    3: 15,
    4: 10,
    5: 8,
    6: 4,
    7: 2,
    8: 1
  },
  'master-1000': {
    1: 12,
    2: 9,
    3: 7,
    4: 5,
    5: 4,
    6: 2,
    7: 1,
    8: 0
  }
} as const;

export const SLOT_TO_POSITION = {
  FG_WINNER: 1,
  FG_LOSER: 2,
  M34_WINNER: 3,
  M34_LOSER: 4,
  FS_WINNER: 5,
  FS_LOSER: 6,
  M78_WINNER: 7,
  M78_LOSER: 8
} as const;
