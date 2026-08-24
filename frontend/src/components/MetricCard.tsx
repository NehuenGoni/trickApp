import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

/**
 * Extraído de pages/admin/AdminDashboard.tsx, que lo tenía local con 4 usos.
 * pages/stats/Stats.tsx necesita el mismo patrón varias veces más — es
 * exactamente el caso que documenta components/SurfaceCard.tsx en su propio
 * comentario ("antes estaba copy-pasteado a mano en cada uno de esos archivos").
 */
const MetricCard = ({
  icon,
  label,
  value,
  hint,
  valueColor
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  /** Ej: verde para una racha ganadora, rojo para una perdedora. Default: color de texto normal. */
  valueColor?: string;
}) => (
  <Paper elevation={3} sx={{ p: 2.5, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: '#D4AF37' }}>
      {icon}
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
    <Typography variant="h4" fontWeight={700} sx={valueColor ? { color: valueColor } : undefined}>
      {value}
    </Typography>
    {hint && (
      <Typography variant="caption" color="text.secondary">
        {hint}
      </Typography>
    )}
  </Paper>
);

export default MetricCard;
