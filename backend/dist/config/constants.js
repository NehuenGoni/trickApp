"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLOT_TO_POSITION = exports.POINTS_TABLE = exports.ALLOWED_LOGO_MIME_TYPES = exports.MAX_LOGO_DIMENSION = exports.MAX_LOGO_BYTES = exports.MAX_SCORE = exports.TOURNAMENT_TEAMS_COUNT = exports.FORMAT_TEAM_SIZE = exports.GUEST_DRAW_MODES = exports.POOL_BASED_FORMATION_MODES = exports.TEAM_FORMATION_MODES = exports.TOURNAMENT_FORMATS = exports.TOURNAMENT_TYPES = exports.BRACKET_SLOTS = exports.MATCH_PHASES = exports.MATCH_STATUS = exports.MATCH_TYPES = exports.PASSWORD_RESET_TTL_MINUTES = exports.MIN_PASSWORD_LENGTH = exports.ADMIN_ROLES = exports.ROLES = exports.FRIENDLY_MATCHES_ID = void 0;
exports.FRIENDLY_MATCHES_ID = 'friendly_matches';
exports.ROLES = {
    USER: 'user',
    ADMIN: 'admin',
    SUPERADMIN: 'superadmin'
};
exports.ADMIN_ROLES = [exports.ROLES.ADMIN, exports.ROLES.SUPERADMIN];
exports.MIN_PASSWORD_LENGTH = 6;
/** Vigencia del enlace de recuperación de contraseña. */
exports.PASSWORD_RESET_TTL_MINUTES = 60;
exports.MATCH_TYPES = {
    FRIENDLY: 'friendly',
    TOURNAMENT: 'tournament'
};
exports.MATCH_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    FINISHED: 'finished'
};
exports.MATCH_PHASES = {
    QUARTER_FINALS: 'quarter-finals',
    SEMIFINALS_GOLD: 'semifinals-gold',
    SEMIFINALS: 'semifinals',
    FINAL_GOLD: 'final-gold',
    FINAL: 'final',
    THIRD_PLACE: 'third-place',
    SEVENTH_PLACE: 'seventh-place'
};
exports.BRACKET_SLOTS = {
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
};
exports.TOURNAMENT_TYPES = {
    GRAND_SLAM: 'grand-slam',
    MASTER_1000: 'master-1000'
};
exports.TOURNAMENT_FORMATS = {
    DUOS: 'duos',
    TRIOS: 'trios'
};
exports.TEAM_FORMATION_MODES = {
    USER_FORMED: 'user-formed',
    RANDOM: 'random',
    CREATOR_FORMED: 'creator-formed'
};
/**
 * Modos en los que la inscripción es individual y `individualSignups` es la
 * fuente de verdad de quién está en el torneo. Los equipos derivan de ese pool
 * (sorteados en `random`, armados a mano en `creator-formed`), así que sus
 * jugadores NO se cuentan aparte al calcular cupos.
 */
exports.POOL_BASED_FORMATION_MODES = [
    exports.TEAM_FORMATION_MODES.RANDOM,
    exports.TEAM_FORMATION_MODES.CREATOR_FORMED
];
exports.GUEST_DRAW_MODES = {
    GROUPED: 'grouped',
    MIXED: 'mixed'
};
exports.FORMAT_TEAM_SIZE = {
    duos: 2,
    trios: 3
};
exports.TOURNAMENT_TEAMS_COUNT = 8;
exports.MAX_SCORE = 30;
/**
 * Límites del logo de torneo.
 * El cliente redimensiona a 512px WebP antes de subir (~45 KB), así que 300 KB
 * deja margen de sobra y a la vez corta cualquier intento de subir el original.
 */
exports.MAX_LOGO_BYTES = 300 * 1024;
/** Tope de ancho/alto, validado leyendo el header sin decodificar la imagen. */
exports.MAX_LOGO_DIMENSION = 1024;
exports.ALLOWED_LOGO_MIME_TYPES = [
    'image/webp',
    'image/png',
    'image/jpeg'
];
exports.POINTS_TABLE = {
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
};
exports.SLOT_TO_POSITION = {
    FG_WINNER: 1,
    FG_LOSER: 2,
    M34_WINNER: 3,
    M34_LOSER: 4,
    FS_WINNER: 5,
    FS_LOSER: 6,
    M78_WINNER: 7,
    M78_LOSER: 8
};
