import React, { useState, useEffect, useCallback } from 'react';
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

interface GuestUser {
  username: string;
  isRegistered: false;
}

type TeamMember = User | GuestUser;

interface TeamForm {
  name: string;
  members: TeamMember[];
  guestName: string;
  _id?: string;
}

interface TournamentForm {
  name: string;
  description: string;
  startDate: string;
  type: 'duos' | 'trios';
  teams: TeamForm[];
}

interface TeamResponse {
  team: {
    _id: string;
    name: string;
    members: Array<{
      name: string;
      playerId: string;
      isGuest: boolean;
    }>;
  };
}

const isAuthError = (error: any) => {
  return error.response?.status === 401 || 
         error.response?.status === 403 || 
         error.message?.includes('token') ||
         error.message?.includes('autenticación');
};

const CreateTournament = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<TournamentForm>({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    type: 'duos',
    teams: []
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);

  const loadAllUsers = useCallback (async () => {
    setSearchingUsers(true);
    try {
      const data = await apiRequest(API_ROUTES.USERS.LIST);
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error al cargar usuarios:', err);
      if (isAuthError(err)) {
        localStorage.removeItem('token');
        navigate('/login', { 
          state: { 
            message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.' 
          }
        });
        return;
      }
      setError('Error al cargar los usuarios');
      setUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  }, [navigate]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      loadAllUsers();
      return;
    }
    
    setSearchingUsers(true);
    try {
      const data = await apiRequest(API_ROUTES.USERS.SEARCH(query));
      console.log('Usuarios encontrados:', data);
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error al buscar usuarios:', err);
      if (isAuthError(err)) {
        localStorage.removeItem('token');
        navigate('/login', { 
          state: { 
            message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.' 
          }
        });
        return;
      }
      setError('Error al buscar usuarios');
      setUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  useEffect(() => {
    if (activeStep === 1) {
      loadAllUsers();
    }
  }, [activeStep, loadAllUsers]);

  const steps = ['Información del Torneo', 'Crear Equipos', 'Vista Previa'];

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.name) {
        setError('Por favor, ingresa un nombre para el torneo');
        return;
      }
      if (!formData.startDate) {
        setError('Por favor, selecciona la fecha de inicio del torneo');
        return;
      }
      if (!formData.type) {
        setError('Por favor, selecciona el tipo de torneo');
        return;
      }
      setError('');
    }
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const generateQuarterFinals = (teams: any[], tournamentId: string) => {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const matches = [];
    
    for (let i = 0; i < shuffledTeams.length; i += 2) {
      const team1 = shuffledTeams[i];
      const team2 = shuffledTeams[i + 1];
      
      console.log('Generando partido con equipos:', {
        team1: { id: team1.teamId, name: team1.name },
        team2: { id: team2.teamId, name: team2.name }
      });

      if (!team1.teamId || !team2.teamId) {
        console.error('Equipos sin ID:', { team1, team2 });
        throw new Error('Los equipos no tienen ID asignado');
      }

      matches.push({
        tournament: tournamentId,
        teams: [
          {
            teamId: team1.teamId,
            score: 0,
            players: team1.players.map((member : any) => ({
              playerId: member.playerId,
              username: member.username
            }))
          },
          {
            teamId: team2.teamId,
            score: 0,
            players: team2.players.map((member : any) => ({
              playerId: member.playerId,
              username: member.username
            }))
          }
        ],
        type: 'tournament',
        phase: 'quarter-finals',
        status: 'in_progress'
      });
    }
    return matches;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.teams.length !== 8) {
      setError("Debes agregar exactamente 8 equipos");
      return;
    }
    setLoading(true);
    try {
      const tournamentResponse = await apiRequest(API_ROUTES.TOURNAMENTS.CREATE, {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          startDate: formData.startDate,
          description: formData.description,
          numberOfTeams: 8
        })
      });

      console.log('Torneo creado:', tournamentResponse);
      const tournamentId = tournamentResponse._id;
      const createdTeams = [];

      for (const team of formData.teams) {     

        const teamMembers = team.members.map((member: any) => {

          if(member._id) {
            console.log('Miembro registrado:', member);
            return {
              name: member.username,
              playerId: member._id,
              isRegistered: true
            };
          } else if(member.isRegistered === false) {
            console.log('Miembro no registrado:', member);
            return {
              name: member.username,
              isRegistered: false
            };
          }
          return {
            name: member.username,
            isRegistered: false
          };
        })

        const teamResponse: TeamResponse = await apiRequest(API_ROUTES.TOURNAMENTS.ADD_TEAM(tournamentId), {
          method: 'POST',
          body: JSON.stringify({
            name: team.name,
            members: teamMembers
          })
        });
        console.log('Equipo creado:', teamResponse);
        
        // Guardar el equipo con su ID generado por el backend
        createdTeams.push(teamResponse.team);
      }

      // Verificar que todos los equipos tengan ID
      console.log('Equipos creados:', createdTeams);
      
      // Generar y crear los partidos de cuartos de final
      const quarterFinals = generateQuarterFinals(createdTeams, tournamentId);
      console.log('Partidos a crear:', JSON.stringify(quarterFinals, null, 2));
      
      try {
        for (const match of quarterFinals) {
          if (!match.teams[0].teamId || !match.teams[1].teamId) {
            console.error('Estructura del partido:', match);
            throw new Error('Faltan teamId en la estructura del partido');
          }

          const matchData = {
            tournament: tournamentId,
            teams: match.teams,
            type: 'tournament',
            phase: 'quarter-finals',
            status: 'in_progress'
          };
          
          console.log('Enviando partido:', JSON.stringify(matchData, null, 2));
          const matchResponse = await apiRequest(API_ROUTES.MATCHES.CREATE, {
            method: 'POST',
            body: JSON.stringify(matchData)
          });
          console.log('Partido creado:', matchResponse);

          // Verificar que el partido se haya creado correctamente
          if (!matchResponse || !matchResponse._id) {
            throw new Error('El partido no se creó correctamente');
          }
        }

        // Verificar que los partidos se hayan creado correctamente
        const matchesUrl = `${API_ROUTES.MATCHES.LIST}?tournament=${tournamentId}`;
        console.log('Obteniendo partidos de:', matchesUrl);
        const tournamentMatches = await apiRequest(matchesUrl);
        console.log('Partidos del torneo:', tournamentMatches);
        
        if (!tournamentMatches || tournamentMatches.length === 0) {
          throw new Error('No se encontraron los partidos del torneo');
        }
      } catch (matchError: any) {
        console.error('Error al crear los partidos:', matchError);
        await apiRequest(API_ROUTES.TOURNAMENTS.DELETE(tournamentId), {
          method: 'DELETE'
        });
        throw new Error(`Error al crear los partidos del torneo: ${matchError.response?.data?.message || matchError.message}`);
      }

      setLoading(false);
      
      navigate(`/tournaments/${tournamentId}`);
    } catch (error: any) {
      console.error('Error al crear el torneo:', error);
      setLoading(false);
      if (isAuthError(error)) {
        localStorage.removeItem('token');
        navigate('/login', { 
          state: { 
            message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.' 
          }
        });
        return;
      }
      
      setError(error.message || "Error al crear el torneo. Por favor, intente nuevamente.");
    }
  };

  const addGuestMember = (teamIndex: number) => {
    const team = formData.teams[teamIndex];
    if (!team.guestName.trim()) return;

    const newTeams = [...formData.teams];
    const guestMember: GuestUser = {
      username: team.guestName.trim(),
      isRegistered: false
    };

    const maxMembers = formData.type === 'duos' ? 2 : 3;
    if (newTeams[teamIndex].members.length >= maxMembers) {
      setError(`No se pueden agregar más de ${maxMembers} miembros al equipo`);
      return;
    }

    newTeams[teamIndex] = {
      ...team,
      members: [...team.members, guestMember],
      guestName: ''
    };
    setFormData({ ...formData, teams: newTeams });
  };

  const addTeam = (team: TeamForm) => {
    if (formData.teams.length >= 8) {
      setError('El torneo debe tener exactamente 8 equipos');
      return;
    }

    const requiredMembers = formData.type === 'duos' ? 2 : 3;
    if (team.members.length !== requiredMembers) {
      setError(`El equipo debe tener exactamente ${requiredMembers} miembros`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      teams: [
        ...prev.teams.slice(0, -1), 
        team,
        { name: `Equipo ${prev.teams.length + 1}`, members: [], guestName: '' }
      ]
    }));
  };

  const removeTeam = (index: number) => {
    setFormData({
      ...formData,
      teams: formData.teams.filter((_, i) => i !== index)
    });
  };

  const getAvailableUsers = (currentTeamIndex: number) => {
    const usersInOtherTeams = formData.teams
      .filter((_, index) => index !== currentTeamIndex) 
      .flatMap(team => 
        team.members
          .filter((member): member is User => !('isGuest' in member))
          .map(member => member._id)
      );
    return users.filter(user => !usersInOtherTeams.includes(user._id));
  };
  
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <>
            <TextField
              fullWidth
              label="Nombre del Torneo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              margin="normal"
            />

            <TextField
              fullWidth
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              margin="normal"
            />

            <Box sx={{ my: 2 }}>
              <TextField
                fullWidth
                label="Fecha de inicio"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Box>

            <Box sx={{ my: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Tipo de Torneo
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant={formData.type === 'duos' ? 'contained' : 'outlined'}
                  onClick={() => setFormData({ ...formData, type: 'duos' })}
                >
                  Parejas (2 jugadores)
                </Button>
                <Button
                  variant={formData.type === 'trios' ? 'contained' : 'outlined'}
                  onClick={() => setFormData({ ...formData, type: 'trios' })}
                >
                  Tríos (3 jugadores)
                </Button>
              </Box>
            </Box>
          </>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Crea 8 equipos para el torneo. 
              El formato será una copa con las siguientes fases:
              <ul>
                <li>Cuartos de final (8 equipos)</li>
                <li>Semifinales de Oro (4 equipos)</li>
                <li>Semifinales de Plata (4 equipos)</li>
                <li>Partido por 3er y 4to puesto</li>
                <li>Partido por 7mo y 8vo puesto</li> 
                <li>Final Plata </li> 
                <li>Final Oro</li>              
              </ul>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                {formData.type === 'duos' 
                  ? 'Cada equipo debe tener exactamente 2 miembros'
                  : 'Cada equipo debe tener exactamente 3 miembros'}
              </Typography>
            </Typography>
            {searchingUsers && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <CircularProgress />
              </Box>
            )}
            {formData.teams.map((team, index) => (
              <Paper key={index} sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">
                    {team.name ? team.name : `Equipo ${index + 1}`}
                  </Typography>
                  <Button
                    color="error"
                    onClick={() => removeTeam(index)}
                    disabled={formData.teams.length <= 2}
                  >
                    Eliminar
                  </Button>
                </Box>
                <TextField
                  fullWidth
                  label="Nombre del Equipo"
                  value={team.name}
                  onChange={(e) => {
                    const newTeams = [...formData.teams];
                    newTeams[index] = { ...team, name: e.target.value };
                    setFormData({ ...formData, teams: newTeams });
                  }}
                  required
                  margin="normal"
                />
                <Autocomplete
                  multiple
                  options={getAvailableUsers(index)}
                  loading={searchingUsers}
                  getOptionLabel={(option: User) => option.username}
                  value={team.members.filter(member => !('isGuest' in member)) as User[]}
                  onChange={(_, newValue) => {
                    const maxMembers = formData.type === 'duos' ? 2 : 3;
                    if (newValue.length + team.members.filter(member => 'isGuest' in member).length <= maxMembers) {
                      const newTeams = [...formData.teams];
                      newTeams[index] = {
                        ...team,
                        members: [
                          ...newValue,
                          ...team.members.filter(member => 'isGuest' in member)
                        ]
                      };
                      setFormData({ ...formData, teams: newTeams });
                    }
                  }}
                  onInputChange={(_, newInputValue) => {
                    if (newInputValue) {
                      searchUsers(newInputValue);
                    } else {
                      searchUsers('');
                    }
                  }}
                  filterOptions={(options) => options}
                  isOptionEqualToValue={(option, value) => option._id === value._id}
                  noOptionsText="No hay más usuarios disponibles. Agrega invitados para completar el equipo."
                  disabled={getAvailableUsers(index).length === 0 && team.members.length < (formData.type === 'duos' ? 2 : 3)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={`Miembros del Equipo (${formData.type === 'duos' ? '2' : '3'} jugadores)`}
                      margin="normal"
                      required
                      error={team.members.length !== (formData.type === 'duos' ? 2 : 3)}
                      helperText={
                        team.members.length < (formData.type === 'duos' ? 2 : 3)
                          ? getAvailableUsers(index).length === 0
                            ? 'No hay más usuarios disponibles. Agrega invitados para completar el equipo.'
                            : `Se necesitan ${formData.type === 'duos' ? '2' : '3'} miembros`
                          : team.members.length > (formData.type === 'duos' ? 2 : 3)
                          ? `No se pueden agregar más de ${formData.type === 'duos' ? '2' : '3'} miembros`
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
                  renderOption={(props, option: User) => (
                    <li {...props}>
                      {option.username}
                    </li>
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
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <TextField
                    fullWidth
                    label="Nombre del Invitado"
                    value={team.guestName}
                    onChange={(e) => {
                      const newTeams = [...formData.teams];
                      newTeams[index] = { ...team, guestName: e.target.value };
                      setFormData({ ...formData, teams: newTeams });
                    }}
                    margin="normal"
                    size="small"
                  />
                  <Button
                    variant="outlined"
                    onClick={() => addGuestMember(index)}
                    disabled={!team.guestName.trim() || team.members.length >= (formData.type === 'duos' ? 2 : 3)}
                    sx={{ mt: 2 }}
                  >
                    Agregar Invitado
                  </Button>
                </Box>
                {team.members
                  .filter((member): member is GuestUser => 'isGuest' in member)
                  .map((member, memberIndex) => (
                    <Chip
                      key={memberIndex}
                      label={member.username}
                      onDelete={() => {
                        const newTeams = [...formData.teams];
                        newTeams[index].members = newTeams[index].members.filter((_, i) => 
                          !('isGuest' in newTeams[index].members[i]) || i !== memberIndex
                        );
                        setFormData({ ...formData, teams: newTeams });
                      }}
                      sx={{ m: 0.5 }}
                    />
                  ))}
              </Paper>
            ))}
            <Button
              variant="outlined"
              onClick={() => {
                if (formData.teams.length === 0) {
                  setFormData(prev => ({
                    ...prev,
                    teams: [{ name: '', members: [], guestName: '' }]
                  }));
                } else {
                  const currentTeam = formData.teams[formData.teams.length - 1];
                  if (currentTeam && currentTeam.members.length === (formData.type === 'duos' ? 2 : 3)) {
                    addTeam(currentTeam);
                  }
                }
              }}
              disabled={
                formData.teams.length >= 8 || 
                (formData.teams.length > 0 && 
                 formData.teams[formData.teams.length - 1].members.length !== (formData.type === 'duos' ? 2 : 3))
              }
              sx={{ mt: 2 }}
            >
              {formData.teams.length < 8 
                ? formData.teams.length > 0 && 
                  formData.teams[formData.teams.length - 1].members.length !== (formData.type === 'duos' ? 2 : 3)
                  ? `Complete el equipo actual (${formData.teams[formData.teams.length - 1].members.length}/${formData.type === 'duos' ? '2' : '3'} miembros)`
                  : `Agregar Equipo (${formData.teams.length}/8)`
                : 'Máximo de equipos alcanzado'}
            </Button>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Vista Previa del Torneo
            </Typography>
            <Typography variant="body1" gutterBottom>
              A continuación se muestra la estructura del torneo con los partidos de cuartos de final:
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Cuartos de Final
              </Typography>
              {Array.from({ length: 4 }, (_, i) => (
                <Paper key={i} sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1">
                    Partido Cuartos de Final {i + 1}
                  </Typography>
                  <Typography variant="body1">
                    {formData.teams[i * 2].name || `Equipo ${i * 2 + 1}`} vs {formData.teams[i * 2 + 1].name || `Equipo ${i * 2 + 2}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formData.teams[i * 2].members.map(member => 
                      'isGuest' in member ? member.username : member.username
                    ).join(', ')} vs {formData.teams[i * 2 + 1].members.map(member => 
                      'isGuest' in member ? member.username : member.username
                    ).join(', ')}
                  </Typography>
                </Paper>
              ))}
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Fases del Torneo
              </Typography>
              <Typography variant="body1" component="div">
                <ul>
                  <li>Cuartos de Final (4 partidos)</li>
                  <li>Semifinales (2 partidos)</li>
                  <li>Final (1 partido)</li>
                  <li>Partido por tercer y cuarto puesto</li>
                </ul>
              </Typography>
            </Box>
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
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Crear Nuevo Torneo
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Stepper activeStep={activeStep} sx={{ mb: 2, mt: 2, ml: -2 }}>
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
                  disabled={loading || formData.teams.length !== 8}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  Crear Torneo
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

export default CreateTournament; 