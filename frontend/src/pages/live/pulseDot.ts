import { SxProps, Theme } from '@mui/material';

/**
 * sx del punto que "late" (usado por el indicador EN VIVO del header y por
 * el estado "jugando" de la escena de equipos). Comparten el mismo keyframe
 * para no duplicarlo en cada lugar que lo necesita.
 */
export const pulseDotSx = (color: string, active: boolean): SxProps<Theme> => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  bgcolor: color,
  transition: 'background-color 400ms ease',
  '@keyframes live-pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.35 }
  },
  animation: active ? 'live-pulse 1.8s ease-in-out infinite' : 'none'
});
