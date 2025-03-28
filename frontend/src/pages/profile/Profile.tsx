import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Avatar,
  Grid,
  TextField,
  Button,
  Alert
} from '@mui/material';
import API_ROUTES, { apiRequest } from '../../config/api';
import NavBar from '../../components/NavBar';

const Profile = () => {
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const data = await apiRequest(API_ROUTES.AUTH.PROFILE);
      setUserData(prev => ({
        ...prev,
        username: data.username,
        email: data.email
      }));
    } catch (err) {
      setError('Error al cargar los datos del usuario');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (userData.newPassword && userData.newPassword !== userData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      await apiRequest(API_ROUTES.AUTH.PROFILE, {
        method: 'PUT',
        body: JSON.stringify({
          username: userData.username,
          currentPassword: userData.currentPassword,
          newPassword: userData.newPassword || undefined
        })
      });
      
      setSuccess('Perfil actualizado correctamente');
      setUserData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el perfil');
    }
  };

  return (
    <Box>
      <NavBar />
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Avatar sx={{ width: 100, height: 100, mb: 2 }}>
              {userData.username.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h5" gutterBottom>
              Editar Perfil
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleUpdateProfile}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre de usuario"
                  name="username"
                  value={userData.username}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  value={userData.email}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Contraseña actual"
                  name="currentPassword"
                  type="password"
                  value={userData.currentPassword}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nueva contraseña"
                  name="newPassword"
                  type="password"
                  value={userData.newPassword}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirmar nueva contraseña"
                  name="confirmPassword"
                  type="password"
                  value={userData.confirmPassword}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                >
                  Actualizar Perfil
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Profile; 