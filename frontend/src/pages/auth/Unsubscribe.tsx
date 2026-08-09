import React, { useEffect, useState } from 'react';
import { Container, Typography, CircularProgress, Box, Link, Alert } from '@mui/material';
import { useParams } from 'react-router-dom';
import API_ROUTES, { apiRequest } from '../../config/api';
import SurfaceCard from '../../components/SurfaceCard';

type Status = 'checking' | 'success' | 'invalid';

/**
 * Baja en un clic desde el link del mail. A propósito NO requiere login: el
 * token HMAC de la URL (ver `unsubscribeToken.ts` en el backend) ya prueba
 * qué preferencia hay que apagar y para quién.
 */
const Unsubscribe = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const data = await apiRequest(API_ROUTES.AUTH.UNSUBSCRIBE(token), { method: 'POST' });
        if (!active) return;
        setMessage(data?.message || 'Listo, ya no vas a recibir ese tipo de aviso.');
        setStatus('success');
      } catch (err) {
        if (!active) return;
        setMessage(err instanceof Error ? err.message : 'El enlace de baja es inválido');
        setStatus('invalid');
      }
    };

    if (!token) {
      setMessage('El enlace de baja es inválido');
      setStatus('invalid');
      return;
    }

    run();
    return () => { active = false; };
  }, [token]);

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'background.default'
        }}
      >
        <SurfaceCard title="Preferencias de notificación" sx={{ textAlign: 'center' }}>
          {status === 'checking' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress color="secondary" />
            </Box>
          )}

          {status === 'success' && <Alert severity="success">{message}</Alert>}
          {status === 'invalid' && <Alert severity="error">{message}</Alert>}

          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Podés ajustar el resto de tus preferencias desde tu perfil.
          </Typography>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link href="/login" variant="body2" sx={{ color: 'secondary.main', fontWeight: 500 }}>
              Ir a TrickApp
            </Link>
          </Box>
        </SurfaceCard>
      </Box>
    </Container>
  );
};

export default Unsubscribe;
