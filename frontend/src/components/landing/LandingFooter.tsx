import React from 'react';
import { Box, Container, Grid, Stack, Typography, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import AppLogo from '../AppLogo';
import { TONES, GOLD } from './landingTokens';

const FooterLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <MuiLink
    component={RouterLink}
    to={to}
    underline="hover"
    color="text.secondary"
    sx={{ display: 'block', py: 0.5, '&:hover': { color: GOLD } }}
  >
    {children}
  </MuiLink>
);

const LandingFooter = () => (
  <Box
    component="footer"
    sx={{ bgcolor: TONES.night, borderTop: `1px solid ${alpha(GOLD, 0.15)}`, pt: 6, pb: 4 }}
  >
    <Container maxWidth="lg">
      <Grid container spacing={4}>
        <Grid item xs={12} md={5}>
          <AppLogo size={28} withText />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 320 }}>
            Torneos de truco para clubes, bares y peñas.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Hecho en Argentina.
          </Typography>
        </Grid>

        <Grid item xs={6} md={3.5}>
          <Typography variant="subtitle2" sx={{ color: GOLD, mb: 1.5, fontWeight: 700 }}>
            Producto
          </Typography>
          <Stack>
            <FooterLink to="/explorar">Torneos y ligas</FooterLink>
            <FooterLink to="/planes">Planes</FooterLink>
            <FooterLink to="/register">Crear cuenta</FooterLink>
            <FooterLink to="/login">Iniciar sesión</FooterLink>
          </Stack>
        </Grid>

        <Grid item xs={6} md={3.5}>
          <Typography variant="subtitle2" sx={{ color: GOLD, mb: 1.5, fontWeight: 700 }}>
            Contacto
          </Typography>
          <MuiLink
            href="mailto:no-reply@trick-app.com"
            underline="hover"
            color="text.secondary"
            sx={{ '&:hover': { color: GOLD } }}
          >
            no-reply@trick-app.com
          </MuiLink>
        </Grid>
      </Grid>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 5, opacity: 0.7 }}
      >
        © {new Date().getFullYear()} TrickApp
      </Typography>
    </Container>
  </Box>
);

export default LandingFooter;
