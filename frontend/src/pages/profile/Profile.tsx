import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Avatar,
  Grid,
  TextField,
  Button,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import API_ROUTES, { apiRequest } from '../../config/api';
import NavBar from '../../components/NavBar';
import SurfaceCard from '../../components/SurfaceCard';
import { useNavigate, useSearchParams } from "react-router-dom";
import PlanTab from './PlanTab';
import NotificationPrefsTab from './NotificationPrefsTab';

type ProfileTab = 'account' | 'plan' | 'notifications';

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: ProfileTab = rawTab === 'plan' || rawTab === 'notifications' ? rawTab : 'account';

  const handleTabChange = (_: React.SyntheticEvent, value: ProfileTab) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'account') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next);
  };

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
        username: data.user.username,
        email: data.user.email
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

      if (userData.newPassword) {
        setTimeout(() => {
          localStorage.removeItem('token');
          navigate('/login');
        }, 1500); // Espera 1.5 segundos para mostrar el mensaje
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el perfil');
    }
  };

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar
            sx={{
              width: 100,
              height: 100,
              mb: 2,
              bgcolor: 'background.paper',
              border: '2px solid #FFD700',
              color: '#FFD700',
              fontSize: '2.5rem',
              fontWeight: 700
            }}
          >
            {userData.username.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="h5" sx={{ color: '#FFD700', fontWeight: 700 }}>
            {userData.username || 'Tu perfil'}
          </Typography>
        </Box>

        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }} centered>
          <Tab label="Cuenta" value="account" />
          <Tab label="Mi Plan" value="plan" />
          <Tab label="Notificaciones" value="notifications" />
        </Tabs>

        {activeTab === 'account' && (
          <SurfaceCard sx={{ maxWidth: 520, mx: 'auto' }}>
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
                    color="secondary"
                    fullWidth
                    size="large"
                  >
                    Actualizar Perfil
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </SurfaceCard>
        )}

        {activeTab === 'plan' && <PlanTab />}
        {activeTab === 'notifications' && <NotificationPrefsTab />}
      </Container>
    </Box>
  );
};

export default Profile; 