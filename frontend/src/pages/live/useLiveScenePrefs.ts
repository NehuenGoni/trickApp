import { useCallback, useEffect, useState } from 'react';

export type LiveSceneId = 'live' | 'bracket' | 'teams';

export const ALL_LIVE_SCENES: LiveSceneId[] = ['live', 'bracket', 'teams'];

// Preferencia por dispositivo (no por torneo): la idea es configurar una vez
// la TV/proyector del club con las pantallas que quiere ver y que se
// mantenga así para cualquier torneo que se transmita ahí después.
const STORAGE_KEY = 'trickapp:live:enabledScenes';

const readStored = (): LiveSceneId[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_LIVE_SCENES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ALL_LIVE_SCENES;
    const valid = parsed.filter((id): id is LiveSceneId => ALL_LIVE_SCENES.includes(id));
    return valid.length > 0 ? valid : ALL_LIVE_SCENES;
  } catch {
    // localStorage puede no estar disponible (modo privado, storage lleno):
    // la preferencia simplemente no persiste, sin romper la vista.
    return ALL_LIVE_SCENES;
  }
};

export const useLiveScenePrefs = () => {
  const [enabled, setEnabled] = useState<LiveSceneId[]>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
    } catch {
      // idem readStored: si falla, se sigue usando el estado en memoria.
    }
  }, [enabled]);

  const toggle = useCallback((id: LiveSceneId) => {
    setEnabled((prev) => {
      const isEnabled = prev.includes(id);
      // Siempre tiene que quedar al menos una pantalla habilitada.
      if (isEnabled && prev.length === 1) return prev;
      return isEnabled ? prev.filter((s) => s !== id) : [...prev, id];
    });
  }, []);

  return { enabled, toggle };
};
