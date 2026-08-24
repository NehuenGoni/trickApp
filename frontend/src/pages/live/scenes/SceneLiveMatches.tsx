import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { LiveMatch, LiveMatchTeam, LiveTournamentData } from '../../../hooks/useLiveTournament';
import { getDisplayScore, getScoreStage } from '../../../utils/truco';
import { PHASE_LABELS, getSlotTheme } from '../../../utils/tournament';
import { usePulseOnChange } from '../usePulseOnChange';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

// Cuántos partidos entran a la vez sin perder el tamaño de card "de
// transmisión". Si hay más, la escena los pagina y el rotador de
// LiveTournament les da un turno a cada página (ver getPageCount).
const MATCHES_PER_PAGE = 4;

const liveMatches = (matches: LiveMatch[]) => matches.filter((m) => m.status === 'in_progress');

export const isSceneVisible = (data: LiveTournamentData): boolean =>
  data.matches.some((m) => m.status === 'in_progress');

export const getPageCount = (data: LiveTournamentData): number =>
  Math.max(1, Math.ceil(liveMatches(data.matches).length / MATCHES_PER_PAGE));

const TeamScore: React.FC<{ team: LiveMatchTeam; dense: boolean }> = ({ team, dense }) => {
  const stage = getScoreStage(team.score);
  const pulsing = usePulseOnChange(team.score);

  return (
    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <Typography
        noWrap
        sx={{ fontWeight: 700, fontSize: dense ? 'clamp(1rem, 1.5vw, 1.5rem)' : 'clamp(1.1rem, 1.8vw, 1.85rem)' }}
      >
        {team.name}
      </Typography>
      {team.players.length > 0 && (
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: 'clamp(0.65rem, 0.9vw, 0.85rem)',
            lineHeight: 1.3,
            // Alto reservado para 2 líneas, en em (escala con el propio
            // fontSize): así, si un equipo envuelve a 2 líneas y el otro a 1,
            // los marcadores de ambos quedan a la misma altura igual.
            minHeight: '2.6em',
            px: 0.5
          }}
        >
          {team.players.join(' - ')}
        </Typography>
      )}
      <Typography
        sx={{
          fontWeight: 800,
          lineHeight: 1,
          // clamp por vw solo (ciego a la altura) hacía que 2 filas de cards
          // no entraran nunca en pantallas bajas. El min() con vh acota
          // también por altura disponible; `dense` (>2 partidos en la
          // página) baja el techo para que 4 cards en 2x2 sigan entrando.
          fontSize: dense ? 'clamp(2rem, min(6.5vw, 11vh), 6rem)' : 'clamp(2rem, min(9vw, 16vh), 9rem)',
          color: stage.color,
          transition: `color 300ms ${EASE}, transform 300ms ${EASE}`,
          transform: pulsing ? 'scale(1.14)' : 'scale(1)',
          my: 1
        }}
      >
        {getDisplayScore(team.score)}
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: stage.color,
          fontSize: 'clamp(0.7rem, 1vw, 1rem)',
          transition: `color 300ms ${EASE}`
        }}
      >
        {stage.label}
      </Typography>
    </Box>
  );
};

const MatchCard: React.FC<{ match: LiveMatch; dense: boolean }> = ({ match, dense }) => {
  const [a, b] = match.teams;
  if (!a || !b) return null;
  const theme = getSlotTheme(match.bracketSlot);

  return (
    <Box
      sx={{
        bgcolor: theme.bg,
        border: '1px solid',
        borderColor: theme.border,
        borderRadius: 3,
        p: { xs: 2, md: 3 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1.5
      }}
    >
      <Typography
        align="center"
        sx={{
          color: theme.accent,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          fontSize: 'clamp(0.75rem, 1.1vw, 1rem)'
        }}
      >
        {match.phase ? PHASE_LABELS[match.phase] ?? match.phase : 'Partido'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: { xs: 1.5, md: 3 } }}>
        <TeamScore team={a} dense={dense} />
        <Typography
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            fontSize: dense ? 'clamp(1.2rem, 2vw, 2rem)' : 'clamp(1.5rem, 3vw, 3rem)',
            mt: { xs: 3, md: 4 }
          }}
        >
          –
        </Typography>
        <TeamScore team={b} dense={dense} />
      </Box>
    </Box>
  );
};

interface Props {
  matches: LiveMatch[];
  page: number;
}

const SceneLiveMatches: React.FC<Props> = ({ matches, page }) => {
  const live = liveMatches(matches);
  if (live.length === 0) return null;

  const pageMatches = live.slice(page * MATCHES_PER_PAGE, (page + 1) * MATCHES_PER_PAGE);
  if (pageMatches.length === 0) return null;

  // 1 partido -> pantalla entera; varios -> grilla (2x2 como máximo por
  // página, ver MATCHES_PER_PAGE). El cálculo es sobre la página, no sobre
  // el total: así el tamaño de card no se achica aunque haya 8 en vivo.
  const colWidth = pageMatches.length === 1 ? 12 : 6;
  const dense = pageMatches.length > 2;
  const paginated = live.length > MATCHES_PER_PAGE;

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 } }}>
      <Typography
        align="center"
        sx={{
          color: '#D4AF37',
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          mb: paginated ? 0.5 : 3,
          fontSize: 'clamp(1rem, 2vw, 1.5rem)'
        }}
      >
        Partidos en vivo
      </Typography>
      {paginated && (
        <Typography
          align="center"
          sx={{ color: 'text.secondary', mb: 3, fontSize: 'clamp(0.7rem, 1vw, 0.9rem)' }}
        >
          {page * MATCHES_PER_PAGE + 1}–{page * MATCHES_PER_PAGE + pageMatches.length} de {live.length}
        </Typography>
      )}
      <Grid container spacing={3}>
        {pageMatches.map((m) => (
          <Grid item xs={12} sm={colWidth} md={colWidth} key={m._id}>
            <MatchCard match={m} dense={dense} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SceneLiveMatches;
