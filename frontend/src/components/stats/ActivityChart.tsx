import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { UserActivityMonth } from '../../types/userStats';

interface ActivityChartProps {
  months: UserActivityMonth[];
}

const monthLabel = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
};

/** Barras apiladas de victorias/derrotas por mes, últimos 12 meses. */
const ActivityChart: React.FC<ActivityChartProps> = ({ months }) => {
  const theme = useTheme();

  if (months.every((m) => m.played === 0)) {
    return (
      <Typography color="text.secondary" variant="body2">
        Todavía no hay actividad para graficar.
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 220 }}>
      <BarChart
        dataset={months.map((m) => ({ ...m, label: monthLabel(m.month) }))}
        xAxis={[{ scaleType: 'band', dataKey: 'label' }]}
        series={[
          { dataKey: 'wins', label: 'Victorias', color: '#4CAF50', stack: 'total' },
          { dataKey: 'losses', label: 'Derrotas', color: '#F44336', stack: 'total' }
        ]}
        height={220}
        margin={{ top: 10, right: 10, bottom: 24, left: 28 }}
        sx={{
          '& .MuiChartsAxis-tickLabel': { fill: theme.palette.text.secondary },
          '& .MuiChartsLegend-label': { fill: theme.palette.text.primary }
        }}
        slotProps={{ legend: { direction: 'row', position: { vertical: 'top', horizontal: 'right' } } }}
      />
    </Box>
  );
};

export default ActivityChart;
