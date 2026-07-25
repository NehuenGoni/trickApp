import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { LiveTournamentData } from '../../../hooks/useLiveTournament';

export const isSceneVisible = (data: LiveTournamentData): boolean => data.matches.length > 0;

const medalColor = (position: number) => {
  if (position === 1) return '#D4AF37';
  if (position === 2) return '#C0C0C0';
  if (position === 3) return '#CD7F32';
  return 'text.primary';
};

const CompletedStandings: React.FC<{ data: LiveTournamentData }> = ({ data }) => (
  <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto' }}>
    {data.standings.map((s) => (
      <Box
        key={`${s.position}-${s.name}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: medalColor(s.position), fontSize: 'clamp(1.2rem, 2vw, 2rem)', minWidth: 48 }}>
            {s.position}°
          </Typography>
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 'clamp(1rem, 1.6vw, 1.5rem)' }}>
            {s.name}
          </Typography>
        </Box>
        <Typography sx={{ fontWeight: 700, color: '#D4AF37', fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', flexShrink: 0 }}>
          {s.points} pts
        </Typography>
      </Box>
    ))}
  </Box>
);

const InProgressStatus: React.FC<{ data: LiveTournamentData }> = ({ data }) => {
  const eliminatedIds = new Set(
    data.matches
      .filter((m) => m.status === 'finished' && m.winner)
      .flatMap((m) => m.teams.filter((t) => t.teamId !== m.winner).map((t) => t.teamId))
  );
  const nameById = new Map(data.teams.map((t) => [t.teamId, t.name]));
  const aliveIds = data.teams.map((t) => t.teamId).filter((id) => !eliminatedIds.has(id));

  return (
    <Grid container spacing={4} sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Grid item xs={12} sm={6}>
        <Typography
          align="center"
          sx={{ color: '#2E7D32', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, mb: 2 }}
        >
          Siguen en carrera
        </Typography>
        {aliveIds.map((id) => (
          <Typography key={id} align="center" sx={{ fontWeight: 600, fontSize: 'clamp(1rem, 1.6vw, 1.4rem)', py: 0.5 }}>
            {nameById.get(id) ?? 'Equipo'}
          </Typography>
        ))}
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography
          align="center"
          sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, mb: 2 }}
        >
          Eliminados
        </Typography>
        {Array.from(eliminatedIds).map((id) => (
          <Typography
            key={id}
            align="center"
            sx={{ color: 'text.secondary', fontSize: 'clamp(0.9rem, 1.4vw, 1.2rem)', py: 0.5, textDecoration: 'line-through' }}
          >
            {nameById.get(id) ?? 'Equipo'}
          </Typography>
        ))}
      </Grid>
    </Grid>
  );
};

interface Props {
  data: LiveTournamentData;
}

const SceneStandings: React.FC<Props> = ({ data }) => {
  const completed = data.tournament.status === 'completed' && data.standings.length > 0;

  return (
    <Box sx={{ width: '100%', px: { xs: 2, md: 4 } }}>
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
        {completed ? 'Posiciones finales' : 'Posiciones'}
      </Typography>
      {completed ? <CompletedStandings data={data} /> : <InProgressStatus data={data} />}
    </Box>
  );
};

export default SceneStandings;
