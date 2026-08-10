import React, { useState } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Box,
  Link,
  Alert
} from '@mui/material';
import API_ROUTES, { apiRequest } from '../../config/api';
import SurfaceCard from '../../components/SurfaceCard';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Ingresá tu email');
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest(API_ROUTES.AUTH.FORGOT_PASSWORD, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      setSuccess(data?.message || 'Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos procesar la solicitud');
    } finally {
      setLoading(false);
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
        <SurfaceCard title="Recuperar contraseña" titleSx={{ mb: 1 }}>
          <Typography variant="body2" align="center" sx={{ mb: 2, color: 'text.secondary' }}>
            Ingresá el email de tu cuenta y te enviamos un enlace para elegir una nueva contraseña.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
              {success}
            </Alert>
          )}

          {!success && (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  if (error) setError('');
                  setEmail(e.target.value);
                }}
                variant="outlined"
                InputProps={{ sx: { borderRadius: 3 } }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="secondary"
                disabled={loading}
                sx={{ mt: 3, mb: 2, py: 1.2, borderRadius: 3 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Enviar enlace'}
              </Button>
            </Box>
          )}

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link
              href="/login"
              variant="body2"
              sx={{ color: 'secondary.main', fontWeight: 500 }}
            >
              Volver al inicio de sesión
            </Link>
          </Box>
        </SurfaceCard>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
