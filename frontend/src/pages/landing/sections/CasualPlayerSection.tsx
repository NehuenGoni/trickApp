import React from 'react';
import { Grid, Stack, Box, Typography, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import Section from '../../../components/landing/Section';
import SectionHeading from '../../../components/landing/SectionHeading';
import LandingImage from '../../../components/landing/LandingImage';
import Reveal from '../../../components/landing/Reveal';
import { GOLD } from '../../../components/landing/landingTokens';
import shotMarcador from '../../../assets/landing/shot-marcador-movil.webp';

const BULLETS = [
  'Partidos sueltos ilimitados, sin límite y sin costo.',
  'La pantalla del celular no se apaga mientras estás jugando.',
  'Te queda el historial de partidos y tus estadísticas personales.',
  'Sumás puntos en el ranking global.'
];

const CasualPlayerSection = () => {
  const navigate = useNavigate();

  return (
    <Section id="jugadores" tone="felt">
      <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
        <Grid item xs={12} md={7} order={{ xs: 2, md: 1 }}>
          <SectionHeading
            align="left"
            eyebrow="¿SOLO QUERÉS JUGAR?"
            title="El contador de truco es gratis. Para siempre."
            subtitle="No hace falta que organices nada ni que pagues un plan. Creás un partido rápido de parejas o tríos, anotás malas y buenas hasta 30 desde el celular, y la pantalla no se te apaga en la mitad de una mano: la app la mantiene encendida sola mientras dura el partido."
          />

          <Stack spacing={1.5} sx={{ mt: 3 }}>
            {BULLETS.map((b, i) => (
              <Reveal delay={i * 60} key={b}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <CheckCircleIcon sx={{ color: GOLD, fontSize: 20, mt: '2px' }} />
                  <Typography variant="body2" color="text.secondary">
                    {b}
                  </Typography>
                </Box>
              </Reveal>
            ))}
          </Stack>

          <Reveal delay={260}>
            <Button
              variant="outlined"
              color="gold"
              size="large"
              sx={{ mt: 4 }}
              onClick={() => navigate('/register')}
            >
              Crear mi cuenta gratis
            </Button>
          </Reveal>
        </Grid>

        <Grid item xs={12} md={5} order={{ xs: 1, md: 2 }}>
          <Reveal delay={80}>
            <Box sx={{ maxWidth: { xs: 240, md: 280 }, mx: 'auto' }}>
              <LandingImage
                framed
                src={shotMarcador}
                width={720}
                height={1114}
                alt="Marcador de truco de TrickApp en el celular, con malas y buenas de Nosotros y Ellos"
              />
            </Box>
          </Reveal>
        </Grid>
      </Grid>
    </Section>
  );
};

export default CasualPlayerSection;
