export const FRIENDLY_MATCHES_ID = 'friendly_matches';

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
} as const;

export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPERADMIN];

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
  RANDOM: 'random'
} as const;

export const FORMAT_TEAM_SIZE = {
  duos: 2,
  trios: 3
} as const;

export const TOURNAMENT_TEAMS_COUNT = 8;

export const MAX_SCORE = 30;

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
