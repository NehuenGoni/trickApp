import React from 'react';
import { Grid, Typography, Box } from '@mui/material';
import SurfaceCard from '../../../components/SurfaceCard';
import Section from '../../../components/landing/Section';
import SectionHeading from '../../../components/landing/SectionHeading';
import LandingImage from '../../../components/landing/LandingImage';
import Reveal from '../../../components/landing/Reveal';
import { GOLD } from '../../../components/landing/landingTokens';
import { FEATURES } from '../content/features';
import ilustracionLiga from '../../../assets/landing/ilustracion-liga.webp';

const FeaturesSection = () => (
  <Section id="producto" tone="night">
    <SectionHeading
      eyebrow="LO QUE HACE"
      title="Todo lo que necesitás para una noche de truco"
      subtitle="Nada de configuración eterna: creás el torneo en dos minutos y la app se encarga del resto."
    />

    <Reveal delay={40}>
      <Box sx={{ maxWidth: 460, mx: 'auto', mt: { xs: 4, md: 5 } }}>
        <LandingImage
          src={ilustracionLiga}
          width={1000}
          height={445}
          alt="Sorteo de parejas de un torneo de TrickApp, tocando la llave desde la tablet"
        />
      </Box>
    </Reveal>

    <Grid container spacing={3} sx={{ mt: { xs: 3, md: 4 } }}>
      {FEATURES.map((f, i) => (
        <Grid item xs={12} sm={6} md={4} key={f.title}>
          <Reveal delay={(i % 3) * 60}>
            <SurfaceCard sx={{ p: 3, height: '100%' }} elevation={0}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(255,215,0,0.1)',
                  mb: 2
                }}
              >
                <f.icon sx={{ color: GOLD, fontSize: 24 }} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {f.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {f.body}
              </Typography>
            </SurfaceCard>
          </Reveal>
        </Grid>
      ))}
    </Grid>
  </Section>
);

export default FeaturesSection;
