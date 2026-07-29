import { useEffect, useRef, useState } from 'react';
import API_ROUTES from '../config/api';
import { TournamentLogoMeta } from '../types/tournament';

export interface LivePlayer {
  name: string;
  isGuest: boolean;
}

export interface LiveTeam {
  teamId: string;
  name: string;
  players: LivePlayer[];
}

export interface LiveMatchTeam {
  teamId: string;
  name: string;
  score: number;
  players: string[];
}

export interface LiveMatch {
  _id: string;
  phase?: string;
  bracketSlot?: string;
  status: 'pending' | 'in_progress' | 'finished';
  winner?: string;
  teams: LiveMatchTeam[];
}

export interface LiveStanding {
  name: string;
  position: number;
  points: number;
}

export interface LiveTournamentInfo {
  _id: string;
  name: string;
  type: 'grand-slam' | 'master-1000';
  format: 'duos' | 'trios';
  status: 'upcoming' | 'in_progress' | 'completed';
  startDate: string;
  description?: string;
  logo?: TournamentLogoMeta | null;
}

export interface LiveTournamentData {
  tournament: LiveTournamentInfo;
  teams: LiveTeam[];
  matches: LiveMatch[];
  standings: LiveStanding[];
}

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'error';

const BASE_POLL_MS = 2500;
const MAX_POLL_MS = 15000;

/**
 * Sondea GET /tournaments/:id/live sin autenticación (deliberado: es la vista
 * pública para un proyector sin sesión, y `apiRequest` redirige a /login ante
 * cualquier 401 o token viejo en localStorage — algo que acá nunca debe pasar).
 *
 * Usa `fetch` directo + `?since=<version>` para que, si nada cambió desde el
 * último poll, el backend responda `{ changed: false }` sin recalcular ni
 * mandar el payload completo. Ante un error de red, no borra `data`: la
 * pantalla sigue mostrando el último estado conocido mientras reintenta con
 * backoff (2.5s → 5s → 10s → tope 15s).
 */
export const useLiveTournament = (tournamentId?: string) => {
  const [data, setData] = useState<LiveTournamentData | null>(null);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const dataRef = useRef<LiveTournamentData | null>(null);
  const versionRef = useRef<string | undefined>(undefined);
  const inFlightRef = useRef(false);
  const pollDelayRef = useRef(BASE_POLL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);

  // Reloj de 1s solo para poder mostrar "actualizado hace Xs" sin depender
  // de que llegue un nuevo poll.
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!tournamentId) return;

    stoppedRef.current = false;
    versionRef.current = undefined;
    pollDelayRef.current = BASE_POLL_MS;
    dataRef.current = null;
    setData(null);
    setStatus('connecting');
    setLastUpdatedAt(null);

    const scheduleNext = (delay: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stoppedRef.current) return;
      timerRef.current = setTimeout(() => { void poll(); }, delay);
    };

    const poll = async () => {
      if (stoppedRef.current) return;
      if (document.hidden) {
        // Pestaña en background: no gastamos requests, pero seguimos
        // reprogramando para retomar apenas vuelva a estar visible.
        scheduleNext(pollDelayRef.current);
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const url = API_ROUTES.TOURNAMENTS.LIVE(tournamentId, versionRef.current);
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        versionRef.current = json.version;
        if (json.changed && json.tournament) {
          const next: LiveTournamentData = {
            tournament: json.tournament,
            teams: json.teams ?? [],
            matches: json.matches ?? [],
            standings: json.standings ?? []
          };
          dataRef.current = next;
          setData(next);
        }
        setLastUpdatedAt(Date.now());
        setStatus('live');
        pollDelayRef.current = BASE_POLL_MS;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') {
          inFlightRef.current = false;
          return;
        }
        setStatus(dataRef.current ? 'reconnecting' : 'error');
        pollDelayRef.current = Math.min(pollDelayRef.current * 2, MAX_POLL_MS);
      } finally {
        inFlightRef.current = false;
        scheduleNext(pollDelayRef.current);
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        // Volvió a foreground: forzamos un poll inmediato en vez de esperar
        // al próximo timer, que pudo haber quedado corriendo en background.
        if (timerRef.current) clearTimeout(timerRef.current);
        void poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    void poll();

    return () => {
      stoppedRef.current = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [tournamentId]);

  const secondsSinceUpdate = lastUpdatedAt !== null
    ? Math.max(0, Math.floor((now - lastUpdatedAt) / 1000))
    : null;

  return { data, status, secondsSinceUpdate };
};
