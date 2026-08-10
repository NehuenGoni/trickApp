import React from 'react';
import { Grid, Stack, Box, Typography, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import Section from '../../../components/landing/Section';
import SectionHeading from '../../../components/landing/SectionHeading';
import LandingImage from '../../../components/landing/LandingImage';
import Reveal from '../../../components/landing/Reveal';
import { GOLD, NIGHT_SIDE_GLOW } from '../../../components/landing/landingTokens';
import shotBracketTv from '../../../assets/landing/shot-bracket-tv.webp';

const BULLETS = [
  'Sin login ni contraseña: la abrís y anda.',
  'Rota cada 15 segundos entre partidos en vivo, llave y equipos.',
  'Desde el celular también podés seguir el torneo en vivo, no hace falta estar frente a la pantalla.',
  'Con el logo de tu club en pantalla, desde el plan Club.',
  'Espacio para el sponsor que te banca la noche, en el plan Pro.'
];

const LiveTvSection = () => {
  const navigate = useNavigate();

  return (
    <Section id="en-vivo" background={NIGHT_SIDE_GLOW}>
      <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
        <Grid item xs={12} md={5} order={{ xs: 2, md: 1 }}>
          <SectionHeading
            align="left"
            eyebrow="PANTALLA EN VIVO"
            title="Poné el torneo en el proyector o la pantalla del local"
            subtitle="Una URL pública, sin login, hecha para proyectar. Rota sola entre los partidos que se están jugando, la llave completa y los equipos anotados. La abrís en el proyector, la pantalla del local o una notebook con HDMI, y te olvidás: se actualiza toda la noche sin que la toques."
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

          <Reveal delay={280}>
            <Button color="gold" sx={{ mt: 3 }} onClick={() => navigate('/explorar')}>
              Ver torneos en vivo ahora →
            </Button>
          </Reveal>
        </Grid>

        <Grid item xs={12} md={7} order={{ xs: 1, md: 2 }}>
          <Reveal delay={80}>
            <LandingImage
              framed
              src={shotBracketTv}
              width={1600}
              height={710}
              alt="La llave de un torneo de truco proyectada en la pantalla de un bar, con equipos y resultados"
            />
          </Reveal>
        </Grid>
      </Grid>
    </Section>
  );
};

export default LiveTvSection;
