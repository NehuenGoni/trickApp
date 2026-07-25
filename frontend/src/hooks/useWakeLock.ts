import { useEffect, useRef } from 'react';

// Antes este hook se desactivaba por completo fuera de dispositivos táctiles
// (`pointer: coarse`), pensado solo para el celular de un jugador. Pero la
// pantalla de transmisión (/live/:id) se proyecta desde una notebook o un
// mini-PC conectado por horas — justo el caso desktop que quedaba afuera.
// La API ya degrada sola con el chequeo de `nav.wakeLock` de abajo donde no
// esté soportada, así que no hace falta filtrar por tipo de dispositivo.
export const useWakeLock = (enabled: boolean) => {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const requestWakeLock = async () => {
      try {
        const nav = navigator as any;

        if (nav.wakeLock && typeof nav.wakeLock.request === 'function') {
          wakeLockRef.current = await nav.wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    };

    requestWakeLock();

    // El navegador libera el wake lock automáticamente al pasar la pestaña a
    // background (requisito de la spec). Sin este listener, una pantalla que
    // se minimiza y se vuelve a mostrar (o una TV que "despierta" el monitor)
    // se queda sin lock hasta un remount manual.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [enabled]);
};