import React from 'react';
import { Box, Typography } from '@mui/material';
import { LiveMatch, LiveTournamentData } from '../../../hooks/useLiveTournament';
import { buildBracketRows, slotLabel, getSlotTheme, bracketSizesFromSlots, zoneBadgeForSlot, ZoneBadge } from '../../../utils/tournament';
import { getDisplayScore, getScoreStage } from '../../../utils/truco';

export const isSceneVisible = (data: LiveTournamentData): boolean => data.matches.length > 0;

// A qué zona pertenece (oro/plata), en texto — el color de la tarjeta ya lo
// insinúa, pero sin la palabra al lado no queda claro cuál es "la de plata"
// una vez que el cuadro no es de 8 equipos y hay más de un partido chico
// peleando puestos bajos (ver conversación: "no queda clara cuál sería la
// final de plata").
const BADGE_LABEL: Record<Exclude<ZoneBadge, null>, string> = { gold: '🥇 Oro', silver: '🥈 Plata' };

const SlotCard: React.FC<{ slot: string; match?: LiveMatch; dense: boolean; badge: ZoneBadge }> = ({
  slot,
  match,
  dense,
  badge
}) => {
  const label = slotLabel(slot);
  const teams = match?.teams ?? [];
  const isLive = match?.status === 'in_progress';
  const theme = getSlotTheme(slot);

  return (
    <Box
      sx={{
        bgcolor: theme.bg,
        borderRadius: 2,
        p: dense ? 1 : 1.5,
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography
          noWrap
          sx={{
            color: theme.accent,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize: dense ? 'clamp(0.55rem, 0.7vw, 0.7rem)' : 'clamp(0.6rem, 0.85vw, 0.8rem)'
          }}
        >
          {label}
        </Typography>
        {badge && (
          <Typography
            noWrap
            sx={{
              color: badge === 'gold' ? '#FFD54F' : '#C0C0C0',
              fontSize: dense ? '0.6rem' : '0.65rem',
              flexShrink: 0
            }}
          >
            {BADGE_LABEL[badge]}
          </Typography>
        )}
      </Box>
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
                fontSize: dense ? 'clamp(0.7rem, 0.85vw, 0.85rem)' : 'clamp(0.75rem, 1vw, 1rem)',
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
                  fontSize: dense ? 'clamp(0.75rem, 0.95vw, 0.95rem)' : 'clamp(0.8rem, 1.1vw, 1.1rem)',
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
  // Una fila por ronda (cuartos, semis, finales...), derivada de los slots
  // que realmente trajo el torneo — funciona igual para el cuadro de 8 de
  // siempre que para cualquier otro tamaño (ver buildBracketRows).
  const rows = buildBracketRows(Array.from(bySlot.keys()));
  // Con cuadros grandes (32 equipos = 16 cruces en la 1ra ronda) bajamos la
  // densidad para que entre más sin depender solo del scroll.
  const maxSlots = rows.length > 0 ? Math.max(...rows.map((r) => r.slots.length)) : 0;
  const dense = maxSlots >= 8;
  const { tournamentSize, goldSize } = bracketSizesFromSlots(Array.from(bySlot.keys()));

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1500,
        mx: 'auto',
        px: { xs: 2, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? { xs: 1.5, md: 2 } : { xs: 2, md: 3 }
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
      {rows.map((row) => (
        <Box key={row.title}>
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
            {row.title}
          </Typography>
          {/* Grilla en vez de flex: con cuadros grandes (32 equipos = 16
              cruces en la 1ra ronda) el ancho fijo por columna hace que las
              tarjetas envuelvan solas a la siguiente línea en vez de
              angostarse hasta ser ilegibles. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(${dense ? 120 : 150}px, 1fr))`,
              gap: dense ? { xs: 1, md: 1.5 } : { xs: 1, md: 2 }
            }}
          >
            {row.slots.map((slot) => (
              <SlotCard
                key={slot}
                slot={slot}
                match={bySlot.get(slot)}
                dense={dense}
                badge={zoneBadgeForSlot(slot, tournamentSize, goldSize)}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default SceneBracket;
