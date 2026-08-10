import React from 'react';
import { Box, Stack, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Section from '../../../components/landing/Section';
import Reveal from '../../../components/landing/Reveal';
import { GOLD, HERO_GLOW } from '../../../components/landing/landingTokens';

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <Section background={HERO_GLOW} maxWidth="md" sx={{ pt: { xs: 8, md: 10 }, pb: { xs: 8, md: 10 }, borderTop: 'none' }}>
      <Box sx={{ textAlign: 'center' }}>
        <Reveal>
          <Typography
            variant="overline"
            sx={{ color: GOLD, letterSpacing: 2, fontWeight: 700, display: 'block', mb: 2 }}
          >
            PARA CLUBES, BARES Y PEÑAS
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.1rem', sm: '2.8rem', md: '3.4rem' },
              lineHeight: 1.15
            }}
          >
            El torneo de truco del bar, organizado como se debe.
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 3, fontSize: '1.15rem', maxWidth: 620, mx: 'auto' }}
          >
            TrickApp arma la llave con doble rama, lleva los puntos y proyecta todo en la
            pantalla del local. Vos atendés la barra; del torneo nos ocupamos nosotros.
          </Typography>
        </Reveal>

        <Reveal delay={90}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            sx={{ mt: 4 }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{ px: 4, width: { xs: '100%', sm: 'auto' } }}
            >
              Armá tu primer torneo gratis
            </Button>
            <Button
              variant="outlined"
              color="gold"
              size="large"
              onClick={() => navigate('/planes')}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Ver los planes
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            El primer torneo es gratis y completo. No pedimos tarjeta.
          </Typography>
        </Reveal>
      </Box>
    </Section>
  );
};

export default HeroSection;
