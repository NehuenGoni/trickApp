import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Box
} from '@mui/material';
import { EmojiEvents as TrophyIcon } from '@mui/icons-material';
import { LeagueStandingRow } from '../types/league';

interface LeagueStandingsTableProps {
  rows: LeagueStandingRow[];
  dense?: boolean;
  highlightUserId?: string;
}

/**
 * Presentacional puro: no hace fetch, solo pinta lo que le pasan. Aparte de
 * LeagueDetails para poder reusarla en Dashboard/perfil más adelante.
 */
const LeagueStandingsTable: React.FC<LeagueStandingsTableProps> = ({
  rows,
  dense = false,
  highlightUserId
}) => {
  if (rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <TrophyIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">
          Todavía no hay puntos para mostrar. Se suman cuando se cierra un torneo de la liga.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size={dense ? 'small' : 'medium'}>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Jugador</TableCell>
            <TableCell align="right">Puntos</TableCell>
            <TableCell align="right">Torneos</TableCell>
            <TableCell align="right">1°</TableCell>
            <TableCell align="right">Podios</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.key}
              selected={!!highlightUserId && row.userId === highlightUserId}
              hover
            >
              <TableCell>{row.position}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {row.displayName}
                  {row.isGuest && <Chip size="small" label="invitado" variant="outlined" />}
                </Box>
              </TableCell>
              <TableCell align="right">
                <strong>{row.points}</strong>
              </TableCell>
              <TableCell align="right">{row.tournamentsPlayed}</TableCell>
              <TableCell align="right">{row.wins}</TableCell>
              <TableCell align="right">{row.podiums}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default LeagueStandingsTable;
