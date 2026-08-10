import React from 'react';
import { Box, Container, SxProps, Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { TONES, GOLD, SectionTone } from './landingTokens';

interface SectionProps {
  id?: string;
  tone?: SectionTone;
  background?: string;
  maxWidth?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

/** Da el ritmo vertical y el fondo a cada bloque de la landing. Nadie
 *  escribe `py` a mano — así el espaciado entre secciones queda uniforme. */
const Section = ({ id, tone = 'felt', background, maxWidth = 'lg', children, sx }: SectionProps) => (
  <Box
    id={id}
    component="section"
    sx={{
      background: background ?? TONES[tone],
      py: { xs: 7, md: 12 },
      borderTop: `1px solid ${alpha(GOLD, 0.08)}`,
      scrollMarginTop: 72,
      ...sx
    }}
  >
    <Container maxWidth={maxWidth}>{children}</Container>
  </Box>
);

export default Section;
