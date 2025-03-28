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
  Autocomplete,
  Chip,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface User {
  _id: string;
  username: string;
}

interface TeamForm {
  name: string;
  members: string[];
}

const CreateTeam = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<TeamForm>({
    name: '',
    members: []
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);

  const steps = ['Información del Equipo', 'Seleccionar Miembros'];

  const handleNext = () => {
    if (activeStep === 0 && !formData.name) {
      setError('Por favor, ingresa un nombre para el equipo');
      return;
    }
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.members.length < 2 || formData.members.length > 3) {
      setError('El equipo debe tener entre 2 y 3 miembros');
      return;
    }

    setLoading(true);
    try {
      await apiRequest(API_ROUTES.TEAMS.CREATE, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      navigate('/teams');
    } catch (err) {
      setError('Error al crear el equipo');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query) return;
    setSearchingUsers(true);
    try {
      const data = await apiRequest(API_ROUTES.USERS.SEARCH(query));
      setUsers(data);
    } catch (err) {
      console.error('Error al buscar usuarios:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <TextField
            fullWidth
            label="Nombre del Equipo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            margin="normal"
          />
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Selecciona entre 2 y 3 miembros para el equipo
            </Typography>
            <Autocomplete
              multiple
              options={users}
              loading={searchingUsers}
              getOptionLabel={(option) => option.username}
              value={users.filter(user => formData.members.includes(user._id))}
              onChange={(_, newValue) => {
                if (newValue.length <= 3) {
                  setFormData({
                    ...formData,
                    members: newValue.map(user => user._id)
                  });
                }
              }}
              onInputChange={(_, newInputValue) => {
                if (newInputValue) {
                  searchUsers(newInputValue);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Miembros del Equipo"
                  margin="normal"
                  required
                  error={formData.members.length < 2 || formData.members.length > 3}
                  helperText={
                    formData.members.length < 2 
                      ? 'Se necesitan al menos 2 miembros'
                      : formData.members.length > 3
                      ? 'No se pueden agregar más de 3 miembros'
                      : ''
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searchingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.username}
                    {...getTagProps({ index })}
                    key={option._id}
                  />
                ))
              }
            />
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Crear Nuevo Equipo
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <form onSubmit={handleSubmit}>
            {getStepContent(activeStep)}

            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {activeStep > 0 && (
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  disabled={loading}
                >
                  Atrás
                </Button>
              )}
              {activeStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || formData.members.length < 2 || formData.members.length > 3}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  Crear Equipo
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={loading}
                >
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

export default CreateTeam; 