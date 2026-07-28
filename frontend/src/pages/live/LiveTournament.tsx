import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Chip, CircularProgress, Typography } from '@mui/material';
import { useLiveTournament, LiveTournamentData } from '../../hooks/useLiveTournament';
import SceneTransition from './SceneTransition';
import SceneLiveMatches, { isSceneVisible as liveMatchesVisible } from './scenes/SceneLiveMatches';
import SceneBracket, { isSceneVisible as bracketVisible } from './scenes/SceneBracket';
import SceneTeams, { isSceneVisible as teamsVisible } from './scenes/SceneTeams';
import { pulseDotSx } from './pulseDot';

const ROTATE_MS = 15000;
const HELP_HIDE_MS = 5000;
const COLOR_LIVE = '#E53935';
const COLOR_STALE = '#F5A623';

const TOURNAMENT_TYPE_LABEL: Record<string, string> = {
  'grand-slam': 'Grand Slam',
  'master-1000': 'Master 1000'
};

interface SceneDef {
  id: 'live' | 'bracket' | 'teams';
  visible: (data: LiveTournamentData) => boolean;
  render: (data: LiveTournamentData) => React.ReactNode;
}

const SCENES: SceneDef[] = [
  { id: 'live', visible: liveMatchesVisible, render: (d) => <SceneLiveMatches matches={d.matches} /> },
  { id: 'bracket', visible: bracketVisible, render: (d) => <SceneBracket matches={d.matches} /> },
  { id: 'teams', visible: teamsVisible, render: (d) => <SceneTeams data={d} /> }
];

const FullscreenMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      minHeight: { xs: '100dvh', md: '100vh' },
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default',
      gap: 2,
      textAlign: 'center',
      px: 3
    }}
  >
    {children}
  </Box>
);

const LiveTournament: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { data, status, secondsSinceUpdate } = useLiveTournament(tournamentId);

  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(true);

  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleScenes = useMemo(
    () => (data ? SCENES.filter((s) => s.visible(data)) : []),
    [data]
  );

  // Si la escena activa deja de existir (por ejemplo, terminó el último
  // partido en vivo y esa escena desaparece), volvemos a un índice válido en
  // vez de quedar mostrando una pantalla vacía.
  useEffect(() => {
    if (activeIndex >= visibleScenes.length && visibleScenes.length > 0) {
      setActiveIndex(0);
      setDirection(0);
    }
  }, [visibleScenes.length, activeIndex]);

  // Rotación automática entre escenas.
  useEffect(() => {
    if (paused || visibleScenes.length <= 1) return;
    rotateTimerRef.current = setTimeout(() => {
      setDirection(0);
      setActiveIndex((i) => (i + 1) % visibleScenes.length);
    }, ROTATE_MS);
    return () => {
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, paused, visibleScenes.length]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        // Algunos navegadores exigen que el gesto de usuario sea "fresco";
        // si falla, simplemente no entra en fullscreen (sin romper la vista).
      });
    }
  }, []);

  const revealHelp = useCallback(() => {
    setShowHelp(true);
    if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
    helpTimerRef.current = setTimeout(() => setShowHelp(false), HELP_HIDE_MS);
  }, []);

  const goNext = useCallback(() => {
    if (!visibleScenes.length) return;
    setDirection(1);
    setPaused(true);
    setActiveIndex((i) => (i + 1) % visibleScenes.length);
  }, [visibleScenes.length]);

  const goPrev = useCallback(() => {
    if (!visibleScenes.length) return;
    setDirection(-1);
    setPaused(true);
    setActiveIndex((i) => (i - 1 + visibleScenes.length) % visibleScenes.length);
  }, [visibleScenes.length]);

  useEffect(() => {
    revealHelp();

    const handleKey = (e: KeyboardEvent) => {
      revealHelp();
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
        return;
      }
      if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    const handleMouseMove = () => revealHelp();

    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousemove', handleMouseMove);
      if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
    };
  }, [revealHelp, toggleFullscreen, goNext, goPrev]);

  // Swipe táctil: navegación entre escenas para pantallas sin teclado.
  const touchStartXRef = useRef<number | null>(null);
  const SWIPE_THRESHOLD_PX = 50;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    revealHelp();
  }, [revealHelp]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) goNext();
    else goPrev();
  }, [goNext, goPrev]);

  if (!tournamentId) {
    return (
      <FullscreenMessage>
        <Alert severity="error">Enlace de transmisión inválido.</Alert>
      </FullscreenMessage>
    );
  }

  if (!data) {
    return (
      <FullscreenMessage>
        {status === 'error' ? (
          <Alert severity="warning" sx={{ maxWidth: 480 }}>
            No se pudo cargar el torneo. Verificá el enlace — seguimos reintentando.
          </Alert>
        ) : (
          <>
            <CircularProgress sx={{ color: '#D4AF37' }} />
            <Typography sx={{ color: 'text.secondary' }}>Conectando con el torneo…</Typography>
          </>
        )}
      </FullscreenMessage>
    );
  }

  const activeScene = visibleScenes[activeIndex];
  const stale = secondsSinceUpdate !== null && secondsSinceUpdate > 10;
  const isDegraded = status === 'reconnecting' || stale;
  const liveColor = isDegraded ? COLOR_STALE : COLOR_LIVE;
  const liveLabel = isDegraded
    ? (secondsSinceUpdate !== null ? `ACTUALIZADO HACE ${secondsSinceUpdate}S` : 'RECONECTANDO')
    : 'EN VIVO';

  return (
    <Box
      sx={{
        // En desktop/proyector se mantiene la pantalla completa fija sin
        // scroll (height + overflow hidden, igual que siempre). En celular
        // la altura es libre: si el contenido no entra, la página scrollea
        // en vez de recortarse.
        height: { xs: 'auto', md: '100vh' },
        minHeight: { xs: '100dvh', md: '100vh' },
        width: '100%',
        overflowY: { xs: 'visible', md: 'hidden' },
        overflowX: 'hidden',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          px: { xs: 2, md: 4 },
          py: 2,
          flexShrink: 0,
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontFamily: "'Merriweather', serif",
              fontWeight: 700,
              fontSize: 'clamp(1.1rem, 2.2vw, 2rem)'
            }}
          >
            {data.tournament.name}
          </Typography>
          <Chip
            label={TOURNAMENT_TYPE_LABEL[data.tournament.type] ?? data.tournament.type}
            size="small"
            sx={{ bgcolor: 'rgba(212,175,55,0.15)', color: '#D4AF37', fontWeight: 600, flexShrink: 0 }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Box sx={pulseDotSx(liveColor, !isDegraded)} />
          <Typography
            noWrap
            sx={{ fontSize: 'clamp(0.65rem, 1vw, 0.85rem)', fontWeight: 700, letterSpacing: 1, color: liveColor }}
          >
            {liveLabel}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          overflowY: { xs: 'visible', md: 'hidden' },
          overflowX: 'hidden',
          py: { xs: 2, md: 0 }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeScene ? (
          <SceneTransition key={activeScene.id} direction={direction}>
            {activeScene.render(data)}
          </SceneTransition>
        ) : (
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', px: 4 }}>
            El torneo todavía no tiene partidos para mostrar.
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          py: 2,
          flexShrink: 0,
          opacity: showHelp ? 1 : 0,
          transition: 'opacity 400ms ease'
        }}
      >
        {visibleScenes.length > 1 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {visibleScenes.map((s, i) => (
              <Box
                key={s.id}
                sx={{
                  width: i === activeIndex ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: i === activeIndex ? '#D4AF37' : 'rgba(255,255,255,0.25)',
                  transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            ))}
          </Box>
        )}
        <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', display: { xs: 'none', md: 'block' } }}>
          F pantalla completa · ← → cambiar escena · Espacio pausar
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', display: { xs: 'block', md: 'none' } }}>
          Deslizá para cambiar de escena
        </Typography>
      </Box>
    </Box>
  );
};

export default LiveTournament;
