import React from 'react';
import { Box, Typography } from '@mui/material';
import { LiveMatch, LiveTournamentData } from '../../../hooks/useLiveTournament';
import { BRACKET_SLOT_ORDER, BRACKET_SLOT_LABELS, getSlotTheme } from '../../../utils/tournament';
import { getDisplayScore, getScoreStage } from '../../../utils/truco';

export const isSceneVisible = (data: LiveTournamentData): boolean => data.matches.length > 0;

const ROW_TITLES = ['Cuartos de Final', 'Semifinales', 'Finales'];
// El orden de la llave es siempre el mismo: 8 equipos, 12 partidos fijos en
// estos slots (ver BRACKET_SLOT_ORDER). Se puede dibujar en 3 filas de 4 sin
// depender del orden en que los partidos llegaron del backend.
const ROWS = [BRACKET_SLOT_ORDER.slice(0, 4), BRACKET_SLOT_ORDER.slice(4, 8), BRACKET_SLOT_ORDER.slice(8, 12)];

const SlotCard: React.FC<{ slot: string; match?: LiveMatch }> = ({ slot, match }) => {
  const label = BRACKET_SLOT_LABELS[slot] ?? slot;
  const teams = match?.teams ?? [];
  const isLive = match?.status === 'in_progress';
  const theme = getSlotTheme(slot);

  return (
    <Box
      sx={{
        bgcolor: theme.bg,
        borderRadius: 2,
        p: 1.5,
        flexBasis: { xs: 'calc(50% - 4px)', md: 0 },
        flexGrow: { md: 1 },
        minWidth: 0,
        border: '1px solid',
        borderColor: isLive ? '#D4AF37' : theme.border,
        transition: 'background-color 300ms ease, border-color 300ms ease',
        '@keyframes pulse-border': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.45)' },
          '50%': { boxShadow: '0 0 0 5px rgba(212,175,55,0)' }
        },
        animation: isLive ? 'pulse-border 2s ease-in-out infinite' : 'none'
      }}
    >
      <Typography
        noWrap
        sx={{
          color: theme.accent,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontSize: 'clamp(0.6rem, 0.85vw, 0.8rem)',
          mb: 0.5
        }}
      >
        {label}
      </Typography>
      {[0, 1].map((i) => {
        const team = teams[i];
        const isWinner = !!match?.winner && !!team && team.teamId === match.winner;
        const stage = team ? getScoreStage(team.score) : null;
        return (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.3, gap: 1 }}>
            <Typography
              noWrap
              sx={{
                fontWeight: isWinner ? 800 : 500,
                color: isWinner ? '#D4AF37' : team ? 'text.primary' : 'text.secondary',
                fontStyle: team ? 'normal' : 'italic',
                fontSize: 'clamp(0.75rem, 1vw, 1rem)',
                minWidth: 0
              }}
            >
              {team ? team.name : 'A definir'}
            </Typography>
            {team && (
              <Typography
                sx={{
                  fontWeight: 700,
                  color: isWinner ? '#D4AF37' : stage?.color,
                  fontSize: 'clamp(0.8rem, 1.1vw, 1.1rem)',
                  flexShrink: 0
                }}
              >
                {getDisplayScore(team.score)}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

interface Props {
  matches: LiveMatch[];
}

const SceneBracket: React.FC<Props> = ({ matches }) => {
  const bySlot = new Map(matches.filter((m) => m.bracketSlot).map((m) => [m.bracketSlot as string, m]));

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1500,
        mx: 'auto',
        px: { xs: 2, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, md: 3 }
      }}
    >
      <Typography
        align="center"
        sx={{
          color: '#D4AF37',
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          fontSize: 'clamp(1rem, 2vw, 1.5rem)'
        }}
      >
        Llave del torneo
      </Typography>
      {ROWS.map((slots, idx) => (
        <Box key={ROW_TITLES[idx]}>
          <Typography
            align="center"
            sx={{
              color: 'text.secondary',
              fontSize: 'clamp(0.7rem, 1vw, 0.9rem)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              mb: 1
            }}
          >
            {ROW_TITLES[idx]}
          </Typography>
          <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, flexWrap: 'wrap' }}>
            {slots.map((slot) => (
              <SlotCard key={slot} slot={slot} match={bySlot.get(slot)} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default SceneBracket;
