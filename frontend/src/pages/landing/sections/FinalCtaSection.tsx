import React from 'react';
import { Box, Grid, Stack, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Section from '../../../components/landing/Section';
import LandingImage from '../../../components/landing/LandingImage';
import Reveal from '../../../components/landing/Reveal';
import { NIGHT_GLOW } from '../../../components/landing/landingTokens';
import ilustracionComunidad from '../../../assets/landing/ilustracion-comunidad.webp';

const FinalCtaSection = () => {
  const navigate = useNavigate();

  return (
    <Section background={NIGHT_GLOW}>
      <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center">
        <Grid item xs={12} md={6}>
          <Reveal>
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography
                variant="h2"
                sx={{ fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' }, lineHeight: 1.2 }}
              >
                La próxima noche de truco, organizala en serio.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, fontSize: '1.05rem' }}>
                Creás la cuenta, armás el torneo y en dos minutos lo tenés proyectado en la
                pantalla del local. El primero es gratis.
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent={{ xs: 'center', md: 'flex-start' }}
                sx={{ mt: 4 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/register')}
                  sx={{ px: 4, width: { xs: '100%', sm: 'auto' } }}
                >
                  Empezar gratis
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
            </Box>
          </Reveal>
        </Grid>

        <Grid item xs={12} md={6}>
          <Reveal delay={80}>
            <Box sx={{ maxWidth: { xs: 320, md: '100%' }, mx: 'auto' }}>
              <LandingImage
                src={ilustracionComunidad}
                width={940}
                height={768}
                alt="Marcador de truco de TrickApp sobre una mesa de paño verde, listo para jugar"
              />
            </Box>
          </Reveal>
        </Grid>
      </Grid>
    </Section>
  );
};

export default FinalCtaSection;
