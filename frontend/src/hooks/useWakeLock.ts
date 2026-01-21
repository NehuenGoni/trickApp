import { useEffect, useRef } from 'react';

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

    return () => {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [enabled]);
};