import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

type TournamentType = 'grand-slam' | 'master-1000';
type TournamentFormat = 'duos' | 'trios';
type TeamFormationMode = 'user-formed' | 'random';

interface TournamentForm {
  name: string;
  description: string;
  startDate: string;
  type: TournamentType;
  format: TournamentFormat;
  teamFormationMode: TeamFormationMode;
}

const isAuthError = (error: { response?: { status?: number }; message?: string }) =>
  error.response?.status === 401 ||
  error.response?.status === 403 ||
  !!error.message?.includes('token') ||
  !!error.message?.includes('autenticación');

const CreateTournament = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<TournamentForm>({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    type: 'grand-slam',
    format: 'duos',
    teamFormationMode: 'user-formed'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = ['Información del torneo', 'Vista previa'];

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.name.trim()) {
        setError('Por favor ingresá un nombre para el torneo');
        return;
      }
      if (!formData.startDate) {
        setError('Por favor elegí una fecha de inicio');
        return;
      }
    }
    setError('');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const created = await apiRequest(API_ROUTES.TOURNAMENTS.CREATE, {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          type: formData.type,
          format: formData.format,
          teamFormationMode: formData.teamFormationMode
        })
      });
      navigate(`/tournaments/${created._id}`);
    } catch (err) {
      const e = err as { response?: { status?: number }; message?: string };
      if (isAuthError(e)) {
        localStorage.removeItem('token');
        navigate('/login', {
          state: { message: 'Tu sesión expiró. Iniciá sesión nuevamente.' }
        });
        return;
      }
      setError(e.message || 'Error al crear el torneo');
    } finally {
      setLoading(false);
    }
  };

  const formationDescription =
    formData.teamFormationMode === 'user-formed'
      ? 'Cada usuario inscribe su equipo armado (con compañeros elegidos por el).'
      : 'Cada usuario se inscribe individualmente; los equipos se sortean al iniciar.';

  const targetParticipants =
    formData.teamFormationMode === 'random'
      ? `${8 * (formData.format === 'duos' ? 2 : 3)} jugadores individuales`
      : '8 equipos';

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Crear nuevo torneo
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 2 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <form onSubmit={handleSubmit}>
            {activeStep === 0 && (
              <Box>
                <TextField
                  fullWidth
                  label="Nombre del torneo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Descripción"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  multiline
                  rows={3}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Fecha de inicio"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                  required
                  margin="normal"
                />

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Tipo de torneo (sistema de puntos)
                  </Typography>
                  <ToggleButtonGroup
                    color="primary"
                    exclusive
                    value={formData.type}
                    onChange={(_, value) =>
                      value && setFormData({ ...formData, type: value })
                    }
                  >
                    <ToggleButton value="grand-slam">Grand Slam</ToggleButton>
                    <ToggleButton value="master-1000">Master 1000</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formData.type === 'grand-slam'
                      ? 'Puntos: 25/18/15/10/8/4/2/1'
                      : 'Puntos: 12/9/7/5/4/2/1/0'}
                  </Typography>
                </Box>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Formato
                  </Typography>
                  <ToggleButtonGroup
                    color="primary"
                    exclusive
                    value={formData.format}
                    onChange={(_, value) =>
                      value && setFormData({ ...formData, format: value })
                    }
                  >
                    <ToggleButton value="duos">Duos (2 jugadores)</ToggleButton>
                    <ToggleButton value="trios">Tríos (3 jugadores)</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Cómo se forman los equipos
                  </Typography>
                  <ToggleButtonGroup
                    color="primary"
                    exclusive
                    value={formData.teamFormationMode}
                    onChange={(_, value) =>
                      value && setFormData({ ...formData, teamFormationMode: value })
                    }
                  >
                    <ToggleButton value="user-formed">
                      Equipos armados por jugadores
                    </ToggleButton>
                    <ToggleButton value="random">
                      Equipos aleatorios
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formationDescription}
                  </Typography>
                </Box>
              </Box>
            )}

            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>Vista previa</Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography><b>Nombre:</b> {formData.name}</Typography>
                  {formData.description && (
                    <Typography><b>Descripción:</b> {formData.description}</Typography>
                  )}
                  <Typography>
                    <b>Fecha:</b> {new Date(formData.startDate).toLocaleDateString()}
                  </Typography>
                  <Typography>
                    <b>Tipo:</b>{' '}
                    {formData.type === 'grand-slam' ? 'Grand Slam' : 'Master 1000'}
                  </Typography>
                  <Typography>
                    <b>Formato:</b> {formData.format === 'duos' ? 'Duos' : 'Tríos'}
                  </Typography>
                  <Typography>
                    <b>Formación de equipos:</b>{' '}
                    {formData.teamFormationMode === 'user-formed'
                      ? 'Armados por jugadores'
                      : 'Aleatorios'}
                  </Typography>
                </Paper>
                <Alert severity="info">
                  El torneo quedará abierto a inscripciones. Esperá a que se completen
                  los cupos ({targetParticipants}) y desde la vista del torneo vas a
                  poder iniciarlo.
                </Alert>
              </Box>
            )}

            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {activeStep > 0 && (
                <Button variant="outlined" onClick={handleBack} disabled={loading}>
                  Atrás
                </Button>
              )}
              {activeStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  Crear torneo
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext} disabled={loading}>
                  Siguiente
                </Button>
              )}
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default CreateTournament;
