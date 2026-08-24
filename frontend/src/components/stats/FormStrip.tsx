import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { UserRecentFormEntry } from '../../types/userStats';

interface FormStripProps {
  entries: UserRecentFormEntry[];
}

/** Tira de chips V/D de los últimos partidos, más reciente primero. */
const FormStrip: React.FC<FormStripProps> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        Todavía no jugaste ningún partido.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {entries.map((entry) => (
        <Tooltip
          key={entry.matchId}
          title={`${entry.scoreFor} vs ${entry.scoreAgainst} — ${new Date(entry.date).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
          })}${entry.opponents.length ? ` · vs ${entry.opponents.join(', ')}` : ''}`}
        >
          <Chip
            label={entry.result === 'win' ? 'V' : 'D'}
            size="small"
            sx={{
              bgcolor: entry.result === 'win' ? '#4CAF50' : '#F44336',
              color: '#fff',
              fontWeight: 'bold',
              minWidth: 32
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
};

export default FormStrip;
