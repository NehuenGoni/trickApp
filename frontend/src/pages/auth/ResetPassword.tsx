import React, { useEffect, useState } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';
import API_ROUTES, { apiRequest } from '../../config/api';
import SurfaceCard from '../../components/SurfaceCard';

const MIN_PASSWORD_LENGTH = 6;

type TokenStatus = 'checking' | 'valid' | 'invalid';

const ResetPassword = () => {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('checking');
  const [tokenError, setTokenError] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Se valida el enlace antes de mostrar el formulario, para no hacer completar
  // una contraseña que va a ser rechazada por un token vencido.
  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const data = await apiRequest(API_ROUTES.AUTH.RESET_PASSWORD(token));
        if (!active) return;
        setAccountEmail(data?.email || '');
        setTokenStatus('valid');
      } catch (err) {
        if (!active) return;
        setTokenError(err instanceof Error ? err.message : 'El enlace es inválido o ya venció');
        setTokenStatus('invalid');
      }
    };

    if (!token) {
      setTokenError('El enlace es inválido o ya venció');
      setTokenStatus('invalid');
      return;
    }

    verify();
    return () => { active = false; };
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('');
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest(API_ROUTES.AUTH.RESET_PASSWORD(token), {
        method: 'POST',
        body: JSON.stringify({ password: formData.password })
      });

      setSuccess(data?.message || 'Contraseña actualizada. Ya podés iniciar sesión.');
      setFormData({ password: '', confirmPassword: '' });

      // El reseteo invalida las sesiones anteriores: se limpia cualquier token local.
      localStorage.removeItem('token');
      localStorage.removeItem('userId');

      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos restablecer la contraseña');
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
        <SurfaceCard title="Nueva contraseña">
          {tokenStatus === 'checking' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress color="secondary" />
            </Box>
          )}

          {tokenStatus === 'invalid' && (
            <Alert severity="error" sx={{ mt: 1, width: '100%' }}>
              {tokenError} Pedí un enlace nuevo desde{' '}
              <Link href="/forgot-password" sx={{ color: 'inherit', fontWeight: 600 }}>
                recuperar contraseña
              </Link>.
            </Alert>
          )}

          {tokenStatus === 'valid' && (
            <>
              {accountEmail && !success && (
                <Typography variant="body2" align="center" sx={{ mb: 1, color: 'text.secondary' }}>
                  Definí la nueva contraseña de <strong>{accountEmail}</strong>
                </Typography>
              )}
              {error && (
                <Alert severity="error" sx={{ mt: 1, width: '100%' }}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert severity="success" sx={{ mt: 1, width: '100%' }}>
                  {success}
                </Alert>
              )}

              {!success && (
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Nueva contraseña"
                    type="password"
                    id="password"
                    autoComplete="new-password"
                    autoFocus
                    value={formData.password}
                    onChange={handleChange}
                    variant="outlined"
                    helperText={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                    InputProps={{ sx: { borderRadius: 3 } }}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="confirmPassword"
                    label="Confirmar contraseña"
                    type="password"
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
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
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Guardar contraseña'}
                  </Button>
                </Box>
              )}
            </>
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

export default ResetPassword;
