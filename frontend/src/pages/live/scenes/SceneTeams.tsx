import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { LiveTournamentData } from '../../../hooks/useLiveTournament';
import { buildTeamRows, TeamRow } from '../teamRows';
import { pulseDotSx } from '../pulseDot';

// A diferencia de las otras escenas, esta no depende de que haya matches:
// con solo tener equipos cargados ya hay algo útil que mostrar (conformación
// de parejas/tríos), incluso antes de que arranque el torneo.
export const isSceneVisible = (data: LiveTournamentData): boolean => data.teams.length > 0;

const PLAYING_COLOR = '#2E7D32';

const medalColor = (position: number | null) => {
  if (position === 1) return '#D4AF37';
  if (position === 2) return '#C0C0C0';
  if (position === 3) return '#CD7F32';
  return 'text.primary';
};

const TeamLine: React.FC<{ row: TeamRow; completed: boolean }> = ({ row, completed }) => {
  // "Eliminado" (tachado + atenuado) solo tiene sentido mientras el torneo
  // está en curso, para distinguir quién sigue jugando. Una vez terminado,
  // todos los equipos ya jugaron su último partido a la vez: tachar a todos
  // por igual no aporta nada y se lee raro en la lista de posiciones finales.
  const isOut = row.state === 'out' && !completed;
  const playersLabel = row.players.map((p) => p.name).join(' · ');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: 1.1,
        px: 2,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        opacity: isOut ? 0.55 : 1
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        {row.position !== null ? (
          <Typography
            sx={{ fontWeight: 800, color: medalColor(row.position), fontSize: 'clamp(1.1rem, 2.5vw, 1.8rem)', minWidth: { xs: 32, md: 44 }, flexShrink: 0 }}
          >
            {row.position}°
          </Typography>
        ) : (
          <Box sx={{ minWidth: { xs: 32, md: 44 }, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            {row.state === 'playing' && <Box sx={pulseDotSx(PLAYING_COLOR, true)} />}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            noWrap
            sx={{ fontWeight: 700, fontSize: 'clamp(0.95rem, 2vw, 1.6rem)', textDecoration: isOut ? 'line-through' : 'none' }}
          >
            {row.name}
          </Typography>
          {playersLabel && (
            <Typography noWrap sx={{ color: 'text.secondary', fontSize: 'clamp(0.75rem, 1.4vw, 1.2rem)' }}>
              {playersLabel}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        {row.points !== null ? (
          <Typography sx={{ fontWeight: 700, color: '#D4AF37', fontSize: 'clamp(0.95rem, 2vw, 1.6rem)' }}>
            {row.points} pts
          </Typography>
        ) : (
          row.phaseLabel && (
            <Typography
              sx={{
                color: row.state === 'playing' ? PLAYING_COLOR : 'text.secondary',
                fontWeight: 600,
                fontSize: 'clamp(0.7rem, 1.4vw, 1.05rem)',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}
            >
              {row.phaseLabel}
            </Typography>
          )
        )}
      </Box>
    </Box>
  );
};

interface Props {
  data: LiveTournamentData;
}

const SceneTeams: React.FC<Props> = ({ data }) => {
  const rows = useMemo(() => buildTeamRows(data), [data]);
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
          mb: 2,
          fontSize: 'clamp(1rem, 2vw, 1.5rem)'
        }}
      >
        {completed ? 'Posiciones finales' : 'Equipos'}
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto' }}>
        {rows.map((row) => (
          <TeamLine key={row.teamId} row={row} completed={completed} />
        ))}
      </Box>
    </Box>
  );
};

export default SceneTeams;
