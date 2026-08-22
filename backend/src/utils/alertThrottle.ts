/**
 * Rate-limit en memoria para las alertas internas (`services/adminAlerts.ts`).
 * Evita que un webhook fallando en loop, o un usuario reintentando la misma
 * acción bloqueada varias veces seguidas, conviertan la casilla del dueño en
 * spam de sí mismo.
 *
 * Nota: con varias máquinas en Fly, cada instancia del proceso tiene su
 * propio `Map`, así que el techo real es "N instancias × 1 alerta por
 * ventana" en vez de una única alerta global. Aceptable a esta escala; si
 * algún día molesta, la ventana se mueve a Mongo (una colección con TTL
 * index, por ejemplo) para compartirla entre instancias.
 */
const lastSentAt = new Map<string, number>();

/**
 * Devuelve `true` la primera vez que se llama con una `key` dada, y de nuevo
 * una vez que pasó `windowMs` desde la última vez que devolvió `true`. Cada
 * llamada que devuelve `true` también hace una limpieza perezosa de las
 * entradas vencidas, así el `Map` no crece sin límite.
 */
export const shouldAlert = (key: string, windowMs: number): boolean => {
  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last !== undefined && now - last < windowMs) return false;

  lastSentAt.set(key, now);

  for (const [k, ts] of lastSentAt) {
    if (now - ts >= windowMs) lastSentAt.delete(k);
  }

  return true;
};
