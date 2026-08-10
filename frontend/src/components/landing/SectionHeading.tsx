import React from 'react';
import { Box, Typography } from '@mui/material';
import { GOLD } from './landingTokens';
import Reveal from './Reveal';

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
}

/** Eyebrow dorado + h2 Merriweather + subhead — el patrón que se repite
 *  en las 9 secciones. El `h2` del theme está fijo en 2rem; acá se
 *  escala por `sx` sin tocar el theme global. */
const SectionHeading = ({ eyebrow, title, subtitle, align = 'center' }: SectionHeadingProps) => (
  <Reveal>
    <Box sx={{ textAlign: align, maxWidth: align === 'center' ? 720 : 560, mx: align === 'center' ? 'auto' : 0 }}>
      {eyebrow && (
        <Typography
          variant="overline"
          sx={{ color: GOLD, letterSpacing: 2, fontWeight: 700, display: 'block', mb: 1.5 }}
        >
          {eyebrow}
        </Typography>
      )}
      <Typography
        variant="h2"
        sx={{ fontSize: { xs: '1.7rem', sm: '2.1rem', md: '2.4rem' }, lineHeight: 1.25 }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, fontSize: '1.05rem' }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  </Reveal>
);

export default SectionHeading;
