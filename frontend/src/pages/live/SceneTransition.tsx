import React from 'react';
import { Box } from '@mui/material';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface Props {
  direction: 1 | -1 | 0; // 0 = rotación automática (rise sutil), ±1 = navegación manual (slide direccional)
  children: React.ReactNode;
}

// Cross-fade + leve desplazamiento al cambiar de escena, para que la
// transmisión nunca "corte" de una pantalla a otra. Sin librería de
// animación: keyframes vía `sx` (emotion viene incluido con MUI).
//
// IMPORTANTE: para que el keyframe se reinicie en cada cambio de escena, el
// componente que renderiza esto debe pasarle `key={sceneId}` — el remount es
// lo que dispara la animación, no un prop interno.
const SceneTransition: React.FC<Props> = ({ direction, children }) => {
  const offset = direction === 0 ? 14 : direction * 40;
  const axis = direction === 0 ? 'translateY' : 'translateX';

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        '@keyframes scene-in': {
          from: { opacity: 0, transform: `${axis}(${offset}px)` },
          to: { opacity: 1, transform: `${axis}(0px)` }
        },
        animation: `scene-in 450ms ${EASE}`
      }}
    >
      {/* margin: 'auto' en vez de alignItems/justifyContent 'center': centra
          igual cuando el contenido entra, pero si es más alto que el
          contenedor el margen colapsa a 0 y se ancla arriba en vez de
          desbordar simétricamente y pisar el header. */}
      <Box sx={{ width: '100%', margin: 'auto', maxHeight: '100%', overflow: 'hidden' }}>{children}</Box>
    </Box>
  );
};

export default SceneTransition;
