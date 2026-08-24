import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';

interface WinRateDonutProps {
  wins: number;
  losses: number;
}

/** Dona victorias/derrotas con el % en el centro. */
const WinRateDonut: React.FC<WinRateDonutProps> = ({ wins, losses }) => {
  const theme = useTheme();
  const played = wins + losses;

  if (played === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        Sin partidos todavía.
      </Typography>
    );
  }

  const winRate = Math.round((wins / played) * 100);

  return (
    <Box sx={{ position: 'relative', width: 140, height: 140, mx: 'auto' }}>
      <PieChart
        series={[
          {
            data: [
              { id: 'wins', value: wins, label: 'Victorias', color: '#4CAF50' },
              { id: 'losses', value: losses, label: 'Derrotas', color: '#F44336' }
            ],
            innerRadius: 45,
            outerRadius: 65,
            paddingAngle: 2
          }
        ]}
        width={140}
        height={140}
        slotProps={{ legend: { hidden: true } }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ color: theme.palette.text.primary }}>
          {winRate}%
        </Typography>
      </Box>
    </Box>
  );
};

export default WinRateDonut;
