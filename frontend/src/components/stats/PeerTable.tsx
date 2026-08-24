import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Typography, Box } from '@mui/material';
import { Groups as GroupsIcon } from '@mui/icons-material';
import { UserStatsPeerRow } from '../../types/userStats';

interface PeerTableProps {
  rows: UserStatsPeerRow[];
  emptyMessage: string;
}

/**
 * Presentacional puro (patrón de LeagueStandingsTable): pinta compañeros y
 * rivales, que comparten exactamente la misma forma de fila.
 */
const PeerTable: React.FC<PeerTableProps> = ({ rows, emptyMessage }) => {
  if (rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <GroupsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Jugador</TableCell>
            <TableCell align="right">PJ</TableCell>
            <TableCell align="right">G</TableCell>
            <TableCell align="right">P</TableCell>
            <TableCell align="right">% Victorias</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {row.displayName}
                  {row.isGuest && <Chip size="small" label="invitado" variant="outlined" />}
                </Box>
              </TableCell>
              <TableCell align="right">{row.played}</TableCell>
              <TableCell align="right">{row.wins}</TableCell>
              <TableCell align="right">{row.losses}</TableCell>
              <TableCell align="right">
                <strong>{Math.round(row.winRate * 100)}%</strong>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PeerTable;
