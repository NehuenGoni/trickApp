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

const TeamLine: React.FC<{ row: TeamRow; completed: boolean; compact: boolean }> = ({ row, completed, compact }) => {
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
            sx={{
              fontWeight: 800,
              color: medalColor(row.position),
              fontSize: compact ? 'clamp(1rem, 1.8vw, 1.3rem)' : 'clamp(1.1rem, 2.5vw, 1.8rem)',
              minWidth: { xs: 32, md: 44 },
              flexShrink: 0
            }}
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
            sx={{
              fontWeight: 700,
              fontSize: compact ? 'clamp(0.85rem, 1.5vw, 1.15rem)' : 'clamp(0.95rem, 2vw, 1.6rem)',
              textDecoration: isOut ? 'line-through' : 'none'
            }}
          >
            {row.name}
          </Typography>
          {playersLabel && (
            <Typography
              noWrap
              sx={{ color: 'text.secondary', fontSize: compact ? 'clamp(0.68rem, 1vw, 0.9rem)' : 'clamp(0.75rem, 1.4vw, 1.2rem)' }}
            >
              {playersLabel}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        {row.points !== null ? (
          <Typography
            sx={{ fontWeight: 700, color: '#D4AF37', fontSize: compact ? 'clamp(0.85rem, 1.5vw, 1.15rem)' : 'clamp(0.95rem, 2vw, 1.6rem)' }}
          >
            {row.points} pts
          </Typography>
        ) : (
          row.phaseLabel && (
            <Typography
              sx={{
                color: row.state === 'playing' ? PLAYING_COLOR : 'text.secondary',
                fontWeight: 600,
                fontSize: compact ? 'clamp(0.62rem, 1vw, 0.85rem)' : 'clamp(0.7rem, 1.4vw, 1.05rem)',
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

// Puestos por columna: con muchos equipos una sola columna se vuelve una
// lista larguísima que solo se lee scrolleando. Repartir en 2-3 columnas
// (leídas verticalmente: 1..N en la primera, N+1..2N en la segunda) mantiene
// todo el ranking visible de un vistazo en desktop.
const columnsFor = (rowCount: number): 1 | 2 | 3 => {
  if (rowCount <= 10) return 1;
  if (rowCount <= 20) return 2;
  return 3;
};

const MAX_WIDTH_BY_COLUMNS: Record<1 | 2 | 3, number> = { 1: 900, 2: 1300, 3: 1700 };

const chunk = <T,>(items: T[], columns: number): T[][] => {
  if (columns <= 1) return [items];
  const perColumn = Math.ceil(items.length / columns);
  return Array.from({ length: columns }, (_, i) => items.slice(i * perColumn, (i + 1) * perColumn));
};

const SceneTeams: React.FC<Props> = ({ data }) => {
  const rows = useMemo(() => buildTeamRows(data), [data]);
  const completed = data.tournament.status === 'completed' && data.standings.length > 0;
  const columns = columnsFor(rows.length);
  const compact = columns > 1;
  const columnRows = useMemo(() => chunk(rows, columns), [rows, columns]);

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
      <Box
        sx={{
          width: '100%',
          maxWidth: MAX_WIDTH_BY_COLUMNS[columns],
          mx: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: `repeat(${columns}, 1fr)` },
          columnGap: 3
        }}
      >
        {columnRows.map((col, i) => (
          <Box key={i}>
            {col.map((row) => (
              <TeamLine key={row.teamId} row={row} completed={completed} compact={compact} />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default SceneTeams;
