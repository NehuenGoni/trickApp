import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Typography
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useLiveTournament, LiveTournamentData } from '../../hooks/useLiveTournament';
import TournamentLogo from '../../components/TournamentLogo';
import SceneTransition from './SceneTransition';
import SceneLiveMatches, { isSceneVisible as liveMatchesVisible, getPageCount as liveMatchesPageCount } from './scenes/SceneLiveMatches';
import SceneBracket, { isSceneVisible as bracketVisible } from './scenes/SceneBracket';
import SceneTeams, { isSceneVisible as teamsVisible } from './scenes/SceneTeams';
import { pulseDotSx } from './pulseDot';
import { useLiveScenePrefs, LiveSceneId } from './useLiveScenePrefs';

const ROTATE_MS = 15000; // cambio de escena
const PAGE_ROTATE_MS = 10000; // cambio de página dentro de la misma escena (ver SceneLiveMatches)
const HELP_HIDE_MS = 5000;
const COLOR_LIVE = '#E53935';
const COLOR_STALE = '#F5A623';

const TOURNAMENT_TYPE_LABEL: Record<string, string> = {
  'grand-slam': 'Grand Slam',
  'master-1000': 'Master 1000'
};

interface SceneDef {
  id: LiveSceneId;
  label: string;
  visible: (data: LiveTournamentData) => boolean;
  // Cuántas "páginas" tiene la escena (p. ej. partidos en vivo paginados de
  // a 4). Ausente = 1. El rotador le da un turno a cada página.
  pageCount?: (data: LiveTournamentData) => number;
  render: (data: LiveTournamentData, page: number) => React.ReactNode;
}

const SCENES: SceneDef[] = [
  {
    id: 'live',
    label: 'Partidos en vivo',
    visible: liveMatchesVisible,
    pageCount: liveMatchesPageCount,
    render: (d, page) => <SceneLiveMatches matches={d.matches} page={page} />
  },
  { id: 'bracket', label: 'Llave del torneo', visible: bracketVisible, render: (d) => <SceneBracket matches={d.matches} /> },
  { id: 'teams', label: 'Equipos', visible: teamsVisible, render: (d) => <SceneTeams data={d} /> }
];

// Una escena expandida a sus páginas: el rotador y los dots navegan sobre
// slots, no sobre escenas, para que "partidos en vivo" con 8 partidos
// consuma 2 turnos en vez de mostrar solo la primera página.
interface SceneSlot {
  key: string;
  sceneId: SceneDef['id'];
  page: number;
  scene: SceneDef;
}

// `enabledIds` es la preferencia del dispositivo (ver useLiveScenePrefs):
// una escena solo entra a la rotación si el torneo tiene contenido para
// mostrarla (visible) Y el usuario no la desactivó desde el menú de ajustes.
const buildSlots = (data: LiveTournamentData, enabledIds: LiveSceneId[]): SceneSlot[] =>
  SCENES.filter((s) => enabledIds.includes(s.id) && s.visible(data)).flatMap((scene) => {
    const pages = scene.pageCount?.(data) ?? 1;
    return Array.from({ length: pages }, (_, page) => ({
      key: `${scene.id}-${page}`,
      sceneId: scene.id,
      page,
      scene
    }));
  });

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

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(true);

  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { enabled: enabledSceneIds, toggle: toggleScene } = useLiveScenePrefs();
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);

  const slots = useMemo(() => (data ? buildSlots(data, enabledSceneIds) : []), [data, enabledSceneIds]);

  // Índice por clave (no por posición numérica): si el polling cambia la
  // cantidad de partidos en vivo, la cantidad de páginas cambia con ella, y
  // un índice numérico fijo pasaría a apuntar a otra escena. La clave
  // mantiene al espectador en la misma escena/página mientras siga existiendo.
  const activeIndex = activeKey ? Math.max(0, slots.findIndex((s) => s.key === activeKey)) : 0;
  const activeSlot = slots[activeIndex];

  // Si el slot activo deja de existir (por ejemplo, terminó el último
  // partido en vivo y esa página desaparece), volvemos al primero en vez de
  // quedar mostrando una pantalla vacía.
  useEffect(() => {
    if (slots.length === 0) return;
    if (!activeKey || !slots.some((s) => s.key === activeKey)) {
      setActiveKey(slots[0].key);
      setDirection(0);
    }
  }, [slots, activeKey]);

  // Rotación automática entre escenas/páginas. El salto a otra página de la
  // misma escena (partidos en vivo paginados) es más corto que el salto a
  // otra escena, para no demorar tanto en mostrar el resto de los partidos.
  useEffect(() => {
    if (paused || slots.length <= 1 || !activeSlot) return;
    const nextSlot = slots[(activeIndex + 1) % slots.length];
    const delay = nextSlot.sceneId === activeSlot.sceneId ? PAGE_ROTATE_MS : ROTATE_MS;
    rotateTimerRef.current = setTimeout(() => {
      setDirection(0);
      setActiveKey(nextSlot.key);
    }, delay);
    return () => {
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, paused, slots]);

  // Afordancia de scroll: cuando el contenido de la escena no entra entero,
  // mostramos un degradado pegado al borde inferior para que se note que hay
  // más para ver scrolleando (si no, el usuario nunca se entera de que puede).
  const sceneContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollAffordance = useCallback(() => {
    const el = sceneContainerRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    updateScrollAffordance();
    const el = sceneContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScrollAffordance);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollAffordance, activeSlot, data]);

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
    if (!slots.length) return;
    setDirection(1);
    setPaused(true);
    setActiveKey((key) => {
      const i = key ? Math.max(0, slots.findIndex((s) => s.key === key)) : 0;
      return slots[(i + 1) % slots.length].key;
    });
  }, [slots]);

  const goPrev = useCallback(() => {
    if (!slots.length) return;
    setDirection(-1);
    setPaused(true);
    setActiveKey((key) => {
      const i = key ? Math.max(0, slots.findIndex((s) => s.key === key)) : 0;
      return slots[(i - 1 + slots.length) % slots.length].key;
    });
  }, [slots]);

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
          <TournamentLogo
            tournament={data.tournament}
            size={72}
            sx={{ width: { xs: 48, md: 72 }, height: { xs: 48, md: 72 } }}
          />
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={pulseDotSx(liveColor, !isDegraded)} />
            <Typography
              noWrap
              sx={{ fontSize: 'clamp(0.65rem, 1vw, 0.85rem)', fontWeight: 700, letterSpacing: 1, color: liveColor }}
            >
              {liveLabel}
            </Typography>
          </Box>
          <IconButton
            size="small"
            aria-label="Elegir pantallas"
            onClick={(e) => setSettingsAnchor(e.currentTarget)}
            sx={{ color: 'text.secondary' }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={settingsAnchor}
            open={Boolean(settingsAnchor)}
            onClose={() => setSettingsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Typography sx={{ px: 2, py: 1, color: 'text.secondary', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.5 }}>
              PANTALLAS A MOSTRAR
            </Typography>
            {SCENES.map((scene) => {
              const checked = enabledSceneIds.includes(scene.id);
              return (
                <MenuItem
                  key={scene.id}
                  onClick={() => toggleScene(scene.id)}
                  disabled={checked && enabledSceneIds.length === 1}
                  dense
                >
                  <Checkbox checked={checked} size="small" sx={{ p: 0, mr: 1.5 }} />
                  <ListItemText primary={scene.label} />
                </MenuItem>
              );
            })}
          </Menu>
        </Box>
      </Box>

      <Box
        ref={sceneContainerRef}
        onScroll={updateScrollAffordance}
        sx={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          // A diferencia del modo anterior (overflow: hidden), acá el
          // contenido que no entra queda alcanzable con scroll en vez de
          // recortado en silencio; el degradado de abajo avisa que hay más.
          overflowY: 'auto',
          overflowX: 'hidden',
          py: { xs: 2, md: 0 },
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 4 },
          scrollbarWidth: 'thin'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeSlot ? (
          <SceneTransition key={activeSlot.key} direction={direction}>
            {activeSlot.scene.render(data, activeSlot.page)}
          </SceneTransition>
        ) : (
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', px: 4 }}>
            El torneo todavía no tiene partidos para mostrar.
          </Typography>
        )}
        {canScrollDown && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 56,
              pointerEvents: 'none',
              background: (theme) => `linear-gradient(transparent, ${theme.palette.background.default})`
            }}
          />
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
        {slots.length > 1 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {slots.map((s, i) => (
              <Box
                key={s.key}
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
