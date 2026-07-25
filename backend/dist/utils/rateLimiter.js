"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = void 0;
/**
 * Limitador de intentos en memoria, pensado para endpoints públicos y de bajo
 * volumen (por ejemplo, pedir un mail de recuperación). Al vivir en el proceso
 * no sirve para varias instancias: si el backend se escala, reemplazar por Redis
 * o `express-rate-limit` con store compartido.
 */
const createRateLimiter = (maxAttempts, windowMs) => {
    const attempts = new Map();
    const purgeExpired = (now) => {
        attempts.forEach((attempt, key) => {
            if (attempt.resetAt <= now)
                attempts.delete(key);
        });
    };
    return {
        /** Registra un intento y devuelve `true` si se superó el límite de la ventana. */
        isLimited(key) {
            const now = Date.now();
            purgeExpired(now);
            const current = attempts.get(key);
            if (!current) {
                attempts.set(key, { count: 1, resetAt: now + windowMs });
                return false;
            }
            current.count += 1;
            return current.count > maxAttempts;
        },
        reset(key) {
            attempts.delete(key);
        }
    };
};
exports.createRateLimiter = createRateLimiter;
