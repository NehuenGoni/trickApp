import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { LiveMatch, LiveMatchTeam, LiveTournamentData } from '../../../hooks/useLiveTournament';
import { getDisplayScore, getScoreStage } from '../../../utils/truco';
import { PHASE_LABELS, getSlotTheme } from '../../../utils/tournament';
import { usePulseOnChange } from '../usePulseOnChange';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const isSceneVisible = (data: LiveTournamentData): boolean =>
  data.matches.some((m) => m.status === 'in_progress');

const TeamScore: React.FC<{ team: LiveMatchTeam }> = ({ team }) => {
  const stage = getScoreStage(team.score);
  const pulsing = usePulseOnChange(team.score);

  return (
    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <Typography
        noWrap
        sx={{ fontWeight: 700, fontSize: 'clamp(1.1rem, 1.8vw, 1.85rem)' }}
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
          fontSize: 'clamp(3.5rem, 9vw, 9rem)',
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

const MatchCard: React.FC<{ match: LiveMatch }> = ({ match }) => {
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
        <TeamScore team={a} />
        <Typography sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 'clamp(1.5rem, 3vw, 3rem)', mt: { xs: 3, md: 4 } }}>
          –
        </Typography>
        <TeamScore team={b} />
      </Box>
    </Box>
  );
};

interface Props {
  matches: LiveMatch[];
}

const SceneLiveMatches: React.FC<Props> = ({ matches }) => {
  const live = matches.filter((m) => m.status === 'in_progress');
  if (live.length === 0) return null;

  // 1 partido -> pantalla entera; varios -> grilla (2x2 en cuartos).
  const colWidth = live.length === 1 ? 12 : 6;

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 } }}>
      <Typography
        align="center"
        sx={{
          color: '#D4AF37',
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          mb: 3,
          fontSize: 'clamp(1rem, 2vw, 1.5rem)'
        }}
      >
        Partidos en vivo
      </Typography>
      <Grid container spacing={3}>
        {live.map((m) => (
          <Grid item xs={12} md={colWidth} key={m._id}>
            <MatchCard match={m} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SceneLiveMatches;
