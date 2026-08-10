import React from 'react';
import { Grid, Stack, Box, Typography } from '@mui/material';
import Section from '../../../components/landing/Section';
import SectionHeading from '../../../components/landing/SectionHeading';
import LandingImage from '../../../components/landing/LandingImage';
import Reveal from '../../../components/landing/Reveal';
import { GOLD } from '../../../components/landing/landingTokens';
import { STEPS } from '../content/steps';
import shotDashboard from '../../../assets/landing/shot-dashboard.webp';

const HowItWorksSection = () => (
  <Section id="como-funciona" tone="felt">
    <SectionHeading eyebrow="EN TRES PASOS" title="De la idea a la pantalla, en dos minutos" />

    <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center" sx={{ mt: { xs: 1, md: 2 } }}>
      <Grid item xs={12} md={6}>
        <Stack spacing={3.5}>
          {STEPS.map((step, i) => (
            <Reveal delay={i * 80} key={step.title}>
              <Box sx={{ display: 'flex', gap: 2.5 }}>
                <Typography
                  sx={{
                    fontFamily: "'Merriweather', serif",
                    fontWeight: 700,
                    fontSize: '2.2rem',
                    color: GOLD,
                    lineHeight: 1,
                    minWidth: 48
                  }}
                >
                  {i + 1}
                </Typography>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.body}
                  </Typography>
                </Box>
              </Box>
            </Reveal>
          ))}
        </Stack>
      </Grid>

      <Grid item xs={12} md={6}>
        <Reveal delay={100}>
          <LandingImage
            framed
            src={shotDashboard}
            width={1200}
            height={516}
            alt="Dashboard de TrickApp con las opciones de Partido Rápido, Torneos y Ligas"
          />
        </Reveal>
      </Grid>
    </Grid>
  </Section>
);

export default HowItWorksSection;
