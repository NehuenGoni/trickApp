import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import useInView from './useInView';
import { EASE_OUT } from './landingTokens';

interface RevealProps {
  children: React.ReactNode;
  /** Retraso en ms, para escalonar varios `Reveal` hermanos (30-90ms entre sí). */
  delay?: number;
  sx?: SxProps<Theme>;
}

/** Fade + slide-up al entrar en viewport. Es la única primitiva de
 *  animación de scroll de la landing — todas las secciones la reusan en
 *  vez de reimplementar su propio IntersectionObserver. */
const Reveal = ({ children, delay = 0, sx }: RevealProps) => {
  const { ref, inView } = useInView();

  return (
    <Box
      ref={ref}
      sx={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ${EASE_OUT} ${delay}ms, transform 0.6s ${EASE_OUT} ${delay}ms`,
        ...sx
      }}
    >
      {children}
    </Box>
  );
};

export default Reveal;
