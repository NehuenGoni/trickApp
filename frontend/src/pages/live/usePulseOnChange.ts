import { useEffect, useRef, useState } from 'react';

/**
 * Devuelve `true` durante un instante cada vez que `value` cambia, para poder
 * animar un "pop" en el número que acaba de actualizarse (ver SceneLiveMatches).
 * No dispara nada en el primer render (evita un pulso falso al montar).
 */
export const usePulseOnChange = (value: unknown, durationMs = 350): boolean => {
  const [pulsing, setPulsing] = useState(false);
  const prevRef = useRef(value);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = value;
      return;
    }
    if (prevRef.current === value) return;
    prevRef.current = value;

    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), durationMs);
    return () => clearTimeout(t);
  }, [value, durationMs]);

  return pulsing;
};
