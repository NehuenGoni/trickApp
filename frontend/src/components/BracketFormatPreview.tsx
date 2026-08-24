import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  previewBracketSlots,
  buildBracketRows,
  slotLabel,
  getSlotTheme,
  restingCountFor,
  splitPoint,
  zoneBadgeForSlot,
  ZoneBadge,
  BracketRow
} from '../utils/tournament';

interface NamedTeam {
  name: string;
}

interface Props {
  numberOfTeams: number;
  /**
   * Cruces reales de la 1ra ronda, en el mismo orden que `firstRoundSlotsFor`
   * (espejo de `splitDraftOrder`) — cuando el torneo ya se sorteó, se
   * muestran los equipos de verdad en vez de "A definir". `undefined` antes
   * de sortear.
   */
  firstRoundPairings?: Array<[NamedTeam, NamedTeam]>;
  /** Equipos que descansan la 1ra ronda, ya sorteados, mismo orden que `restEntrySlots`. */
  restingTeams?: NamedTeam[];
}

// Mismo texto que en la llave en vivo (`SceneBracket`): el color de la
// tarjeta ya insinúa la zona, pero sin la palabra al lado no queda claro
// cuál sería "la final de plata" una vez que hay más de un partido chico
// peleando puestos bajos.
const BADGE_LABEL: Record<Exclude<ZoneBadge, null>, string> = { gold: '🥇 Oro', silver: '🥈 Plata' };

const RestCard: React.FC<{ team?: NamedTeam }> = ({ team }) => (
  <Box
    sx={{
      borderRadius: 2,
      p: 1.5,
      minWidth: 0,
      border: '1px dashed rgba(255,255,255,0.25)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 0.5
    }}
  >
    {team && (
      <Typography noWrap sx={{ fontWeight: 700, maxWidth: '100%' }}>
        {team.name}
      </Typography>
    )}
    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
      Descansa esta ronda
    </Typography>
    <Typography sx={{ color: '#FFD54F', fontSize: '0.65rem' }}>{BADGE_LABEL.gold}</Typography>
  </Box>
);

const PreviewCard: React.FC<{ slot: string; label: string; badge: ZoneBadge; teams?: [NamedTeam, NamedTeam] }> = ({
  slot,
  label,
  badge,
  teams
}) => {
  const theme = getSlotTheme(slot);
  return (
    <Box
      sx={{
        bgcolor: theme.bg,
        borderRadius: 2,
        p: 1.5,
        minWidth: 0,
        border: '1px solid',
        borderColor: theme.border
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
        <Typography sx={{ color: theme.accent, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
          {label}
        </Typography>
        {badge && (
          <Typography noWrap sx={{ color: badge === 'gold' ? '#FFD54F' : '#C0C0C0', fontSize: '0.65rem', flexShrink: 0 }}>
            {BADGE_LABEL[badge]}
          </Typography>
        )}
      </Box>
      {teams ? (
        teams.map((t, i) => (
          <Typography key={i} noWrap sx={{ fontSize: '0.85rem' }}>
            {t.name}
          </Typography>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          A definir
        </Typography>
      )}
    </Box>
  );
};

// Dentro de una fila, distintos cruces pueden compartir el mismo rango de
// puestos (p.ej. dos cruces que pelean los puestos 1-4 en una zona pareja) o,
// en la 1ra ronda, TODOS lo comparten (todavía no se sabe qué puesto define
// cada uno). Sin nombre de equipo de por medio (esto es una vista previa, no
// el torneo ya sorteado) hace falta numerarlos para que no se vean idénticos.
const labelsForRow = (row: BracketRow, isFirstRow: boolean): string[] => {
  if (isFirstRow) {
    return row.slots.map((_, i) => `Cruce ${i + 1}`);
  }
  const counts = new Map<string, number>();
  for (const slot of row.slots) {
    const base = slotLabel(slot);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return row.slots.map((slot) => {
    const base = slotLabel(slot);
    const total = counts.get(base)!;
    if (total <= 1) return base;
    const idx = (seen.get(base) ?? 0) + 1;
    seen.set(base, idx);
    return `${base} · cruce ${idx}/${total}`;
  });
};

/**
 * Vista previa de la llave ANTES de sortear: mismos colores y agrupamiento
 * por ronda que la llave real de `/live/:id` (`SceneBracket`), pero con
 * placeholders en vez de equipos, para que el organizador y los inscriptos
 * entiendan la estructura del torneo (zona de oro/plata, quién descansa)
 * antes de que haya un solo partido jugado. Sin `Paper` ni título propios:
 * quien lo use decide cómo enmarcarlo (en `TournamentDetails` va dentro de un
 * `Accordion`, con el título en el `AccordionSummary`).
 */
const BracketFormatPreview: React.FC<Props> = ({ numberOfTeams, firstRoundPairings, restingTeams }) => {
  const rows = buildBracketRows(previewBracketSlots(numberOfTeams));
  const resting = restingCountFor(numberOfTeams);
  const goldSize = splitPoint(numberOfTeams);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Es un cuadro de <b>clasificación completa</b>: nadie queda eliminado. El equipo que
        pierde no sale del torneo, baja de zona y sigue jugando por su puesto, hasta que los{' '}
        {numberOfTeams} equipos terminan con una posición final exacta (del 1° al {numberOfTeams}°).
        {resting > 0 && (
          <>
            {' '}
            Como {numberOfTeams} no se puede dividir en mitades parejas todo el camino,{' '}
            {resting === 1 ? 'un equipo descansa' : `${resting} equipos descansan`} en la primera
            ronda (se sortea junto con los cruces) y {resting === 1 ? 'pasa' : 'pasan'} directo a
            pelear los puestos 1-{goldSize}: descansar nunca resta puntos ni ubicación, todo lo
            contrario.
          </>
        )}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row, rowIndex) => {
          const isFirstRow = rowIndex === 0;
          const labels = labelsForRow(row, isFirstRow);
          return (
            <Box key={row.title}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}
              >
                {row.title}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1 }}>
                {row.slots.map((slot, i) => (
                  <PreviewCard
                    key={slot}
                    slot={slot}
                    label={labels[i]}
                    badge={zoneBadgeForSlot(slot, numberOfTeams, goldSize)}
                    teams={isFirstRow ? firstRoundPairings?.[i] : undefined}
                  />
                ))}
                {isFirstRow &&
                  Array.from({ length: resting }).map((_, i) => (
                    <RestCard key={`rest-${i}`} team={restingTeams?.[i]} />
                  ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default BracketFormatPreview;
