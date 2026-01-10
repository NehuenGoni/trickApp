import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Box,
  Link,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import API_ROUTES, { apiRequest } from '../../config/api';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if(submitError){setSubmitError('')}
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setSubmitError("Por favor completa todos los campos");
      return;
    }
    try {
      setLoading(true);
      const data = await apiRequest(API_ROUTES.AUTH.LOGIN, {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);
      
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en el inicio de sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "background.default",
        }}
      >
        <Paper
          elevation={6}
          sx={{
            p: 4, 
            bgcolor: "background.paper", 
            border: "1px solid #FFD700", 
            borderRadius: 3,
            boxShadow: "0px 4px 12px rgba(0,0,0,0.4)"
          }}
        >
          <Typography
            variant="h5" 
            align="center" 
            sx={{ mb: 2, fontWeight: 700, color: "#FFD700" }}
          >
            Iniciar Sesión
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error}
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {submitError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              variant="outlined"
              InputProps={{ sx: { borderRadius: 3 } }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Contraseña"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) => {
                if (submitError) setSubmitError('');
                handleChange(e);
              }}
              variant="outlined"
              InputProps={{ sx: { borderRadius: 3 } }}
            />
           <Button
              type="submit"
              fullWidth
              variant="contained"
              color='secondary'
              sx={{
                mt: 3,
                mb: 2,
                py: 1.2,
                borderRadius: 3
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
            </Button>
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Link
                href="/register"
                variant="body2"
                sx={{ color: "secondary.main", fontWeight: 500 }}
              >
                ¿No tienes una cuenta? Regístrate
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 