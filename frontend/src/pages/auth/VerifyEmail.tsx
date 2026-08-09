import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  CircularProgress,
  Box,
  Link,
  Alert,
  Button
} from '@mui/material';
import { useParams } from 'react-router-dom';
import API_ROUTES, { apiRequest } from '../../config/api';
import { clearCurrentUserCache } from '../../hooks/useCurrentUser';

type Status = 'checking' | 'success' | 'invalid';

const VerifyEmail = () => {
  const { token = '' } = useParams<{ token: string }>();

  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const data = await apiRequest(API_ROUTES.AUTH.VERIFY_EMAIL(token), { method: 'POST' });
        if (!active) return;
        // El perfil cacheado (NavBar, banner) tiene `emailVerified: false` de la
        // sesión anterior: hay que invalidarlo para que el próximo fetch lo refleje.
        clearCurrentUserCache();
        setMessage(data?.message || 'Cuenta confirmada. Ya podés crear torneos y suscribirte a un plan.');
        setStatus('success');
      } catch (err) {
        if (!active) return;
        setMessage(err instanceof Error ? err.message : 'El enlace es inválido o ya venció');
        setStatus('invalid');
      }
    };

    if (!token) {
      setMessage('El enlace es inválido o ya venció');
      setStatus('invalid');
      return;
    }

    verify();
    return () => { active = false; };
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    try {
      // No conocemos el email acá (el token vencido no se puede leer sin
      // validarlo), así que el backend deriva el destinatario de la sesión activa.
      await apiRequest(API_ROUTES.AUTH.PROFILE).then((data) =>
        apiRequest(API_ROUTES.AUTH.RESEND_VERIFICATION, {
          method: 'POST',
          body: JSON.stringify({ email: data.user.email })
        })
      );
      setResent(true);
    } catch {
      // Si no hay sesión activa (llegó acá sin loguearse), no hay a quién reenviarle:
      // el mensaje de abajo ya lo manda a loguearse para pedirlo desde ahí.
    } finally {
      setResending(false);
    }
  };

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
        <Paper
          elevation={6}
          sx={{
            p: 4,
            bgcolor: 'background.paper',
            border: '1px solid #FFD700',
            borderRadius: 3,
            boxShadow: '0px 4px 12px rgba(0,0,0,0.4)',
            textAlign: 'center'
          }}
        >
          <Typography
            variant="h5"
            align="center"
            sx={{ mb: 2, fontWeight: 700, color: '#FFD700' }}
          >
            Confirmación de cuenta
          </Typography>

          {status === 'checking' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress color="secondary" />
            </Box>
          )}

          {status === 'success' && (
            <>
              <Alert severity="success" sx={{ mt: 1, mb: 2 }}>{message}</Alert>
              <Button variant="contained" color="secondary" href="/dashboard" sx={{ borderRadius: 3 }}>
                Ir al dashboard
              </Button>
            </>
          )}

          {status === 'invalid' && (
            <>
              <Alert severity="error" sx={{ mt: 1, mb: 2 }}>{message}</Alert>
              {!resent ? (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleResend}
                  disabled={resending}
                  sx={{ borderRadius: 3 }}
                >
                  {resending ? <CircularProgress size={20} color="inherit" /> : 'Pedir un enlace nuevo'}
                </Button>
              ) : (
                <Alert severity="info">Si tenés sesión iniciada, te mandamos un enlace nuevo.</Alert>
              )}
            </>
          )}

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Link href="/login" variant="body2" sx={{ color: 'secondary.main', fontWeight: 500 }}>
              Volver al inicio de sesión
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default VerifyEmail;
