import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Box, Button, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import AppLogo from '../AppLogo';
import { TONES, GOLD, EASE_OUT } from './landingTokens';

const ANCHORS = [
  { href: '#producto', label: 'Producto' },
  { href: '#en-vivo', label: 'En vivo' },
  { href: '#planes', label: 'Planes' },
  { href: '#faq', label: 'Preguntas' }
];

/** AppBar propia de la landing — no reutiliza `NavBar.tsx`, que monta
 *  `useCurrentUser` (dispara un fetch autenticado) y el banner de
 *  verificación de email. Acá no hay sesión: es tráfico frío. */
const LandingNav = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: scrolled ? alpha(TONES.night, 0.85) : TONES.night,
        backdropFilter: scrolled ? 'blur(8px)' : 'none',
        borderBottom: `1px solid ${alpha(GOLD, scrolled ? 0.25 : 0.12)}`,
        transition: `background-color 0.3s ${EASE_OUT}, border-color 0.3s ${EASE_OUT}`
      }}
    >
      <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto', gap: 2 }}>
        <AppLogo size={30} withText onClick={() => navigate('/')} />

        <Stack
          direction="row"
          spacing={0.5}
          sx={{ ml: 2, flexGrow: 1, display: { xs: 'none', md: 'flex' } }}
        >
          {ANCHORS.map((a) => (
            <Button key={a.href} href={a.href} color="inherit" sx={{ color: 'text.secondary' }}>
              {a.label}
            </Button>
          ))}
          <Button color="inherit" sx={{ color: 'text.secondary' }} onClick={() => navigate('/explorar')}>
            Torneos y ligas
          </Button>
        </Stack>

        <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />

        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            color="gold"
            onClick={() => navigate('/login')}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Iniciar sesión
          </Button>
          <Button variant="contained" size="small" onClick={() => navigate('/register')}>
            Crear cuenta gratis
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default LandingNav;
