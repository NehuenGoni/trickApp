import React, { useState, useEffect } from 'react';
import {
  Container,
  CircularProgress,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent,
  Alert,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PeopleAltOutlined,
  PeopleOutline
} from '@mui/icons-material';
import { Types } from 'mongoose';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface User {
  _id: string;
  username: string;
}

interface RegisteredPlayer {
  _id: string;
  username: string;
  isRegistered: true;
}

interface GuestPlayer {
  guestId: string;
  username: string;
  isRegistered: false;
}

type Player = RegisteredPlayer | GuestPlayer;

interface Team {
  players: Player[];
  name?: string;
}

// interface IMatch {
//   tournament?: string;
//   teams: {
//     teamId: string;
//     score: number;
//   }[]; 
//   winner?: string; 
//   status: "in_progress" | "finished";
//   createdAt: Date;
// }

const CreateMatch = () => {
  const navigate = useNavigate();
  const [matchType, setMatchType] = useState('pairs');
  const [users, setUsers] = useState<User[]>([]);

  const fetchUserData = async () => {
    try {
      const data = await apiRequest(API_ROUTES.AUTH.PROFILE);
      setSelectedPlayers(prev => {
        const alreadyExists = prev.some(player => player.isRegistered && player._id === data.user._id)
        if (alreadyExists) {return prev}
        const currentUserPlayer: Player = {
          _id: data.user._id,  
          username: data.user.username,
          isRegistered: true
      }
      return [currentUserPlayer, ...prev];    
  })
    } catch (err) {
      setError('Error al cargar los datos del usuario');
    }
  };

  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchUserData()
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiRequest(API_ROUTES.USERS.LIST);
      setUsers(data);
    } catch (err) {
      console.error('Error al cargar los usuarios:', err);
    }
  };

  const handleTypeChange = (event: SelectChangeEvent) => {
    setMatchType(event.target.value);
    setSelectedPlayers([]);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAddGuest = () => {
    if (!guestName.trim()) {
      setError('Ingresa un nombre para el invitado');
      return;
    }

    const newGuest: GuestPlayer = {
      guestId: `guest-${Date.now()}`,
      username: guestName.trim(),
      isRegistered: false
    };

    setSelectedPlayers([...selectedPlayers, newGuest]);
    setGuestName('');
    setError('');
  };

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(player => player.isRegistered && player._id !== playerId));
  };

  const handleRegisteredPlayerSelection = (event: SelectChangeEvent<string[]>) => {
    const selectedIds = Array.isArray(event.target.value) ? event.target.value : [event.target.value];
    //console.log('IDs seleccionados:', selectedIds);

    if (selectedIds.length > getMaxPlayers()) {
      setError('Has excedido el número máximo de jugadores permitidos');
      return;
    }

    const selectedRegisteredPlayers: RegisteredPlayer[] = users
      .filter(user => selectedIds.includes(user._id))
      .map(user => ({
        _id: user._id,
        username: user.username,
        isRegistered: true
      }));

    //console.log('Jugadores seleccionados:', selectedRegisteredPlayers);

    const newSelectedPlayers = Array.from(
      new Map(
        [
          ...selectedPlayers.filter(p => p.isRegistered ? p._id : p.guestId),
          ...selectedRegisteredPlayers,
        ].map(player => [player.isRegistered ? player._id : player.guestId, player])
      ).values()
    );
    //console.log('Nuevo estado de jugadores:', newSelectedPlayers);

    setSelectedPlayers(newSelectedPlayers);
    setError('');
  };

  const getMaxPlayers = () => {
    return matchType === 'pairs' ? 4 : 6; 
  };

  const handleCreateMatch = async () => {
    if (selectedPlayers.length < getMaxPlayers()) {
      setError('Selecciona la cantidad correcta de jugadores');
      return;
    }
    
    const teams = dividePlayersIntoTeams(selectedPlayers, matchType);

    setLoading(true);

    //console.log('Creando partido con equipos:', teams);
    try {
      const response = await apiRequest(API_ROUTES.MATCHES.CREATE, {
        method: 'POST',
        body: JSON.stringify({
          type: 'friendly',
          matchType: matchType,
          teams: teams.map((team, index) => ({
            teamId: new Types.ObjectId(),
            players: team.players.map((player) => {
              if (player.isRegistered) {
                return {
                  playerId: player._id,
                  isGuest: false
                };
              }

              return {
                guestId: player.guestId,
                username: player.username,
                isGuest: true
              };
            }),
            score: 0
          })),
          status: "in_progress"
        })
      });

      //console.log('Partido creado:', response);
      
      navigate(`/matches/scoreboard/${response._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el partido');
    } finally {
      setLoading(false);
    }
  };

  const dividePlayersIntoTeams = (players: Player[], matchType: string): Team[] => {
    const playersPerTeam = matchType === 'pairs' ? 2 : 3;
    const teams: Team[] = [];
    
    for (let i = 0; i < players.length; i += playersPerTeam) {
      const teamPlayers = players.slice(i, i + playersPerTeam);
      teams.push({
        players: teamPlayers,
        name: `Equipo ${teams.length + 1}`
      });
    }
    
    return teams;
  };

  return (
    <Box>
      <NavBar />
      <Container maxWidth="sm" sx={{ mt: 4 }}>
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
            Crear Nuevo Partido
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo de Partido</InputLabel>
              <Select
                value={matchType}
                label="Tipo de Partido"
                onChange={handleTypeChange}
              >
                <MenuItem value="pairs">Parejas</MenuItem>
                <MenuItem value="trios">Tríos</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {matchType === 'pairs' ? 'Parejas' : 'Tríos'} - 
              Equipos Formados ({selectedPlayers.length}/{getMaxPlayers()})
            </Typography>
            
            {dividePlayersIntoTeams(selectedPlayers, matchType).map((team, index) => (
              <Paper key={index} sx={{ p: 2, mb: 2, }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {team.name}
                </Typography>
                <List dense>
                  {team.players.map((player) => (
                    <ListItem key={player.isRegistered ? player._id : player.guestId}>
                      <ListItemText 
                        primary={player.username}
                        secondary={'isGuest' in player ? 'Invitado' : 'Registrado'}
                      />
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          color='secondary'
                          onClick={() => handleRemovePlayer(player.isRegistered ? player._id : player.guestId)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            ))}
          </Box>

          <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, mb: 2 }}>
            <Button
              variant={tabValue === 0 ? "contained" : "outlined"}
              onClick={() => setTabValue(0)}
              size="small"
              startIcon={<PeopleOutline sx={{ fontSize: 16 }} />}
              sx={{
                flex: 1, 
                maxWidth: '50%', 
                bgcolor: tabValue === 0 ? "#FFD700" : "transparent",
                color: tabValue === 0 ? "#000" : "#CED4DA",
                borderColor: "#FFD700",
                "&:hover": {
                  bgcolor: tabValue === 0 ? "#FFC400" : "rgba(255, 215, 0, 0.1)"
                }
              }}
            >
              Registrados
            </Button>
            <Button
              variant={tabValue === 1 ? "contained" : "outlined"}
              onClick={() => setTabValue(1)}
              size="small"
              startIcon={<PeopleAltOutlined sx={{ fontSize: 16 }} />}
              sx={{
                flex: 1, 
                maxWidth: '50%', 
                bgcolor: tabValue === 1 ? "#FFD700" : "transparent",
                color: tabValue === 1 ? "#000" : "#CED4DA",
                borderColor: "#FFD700",
                "&:hover": {
                  bgcolor: tabValue === 1 ? "#FFC400" : "rgba(255, 215, 0, 0.1)"
                }
              }}
            >
              Invitado
            </Button>
          </Box>

          <Box sx={{ display: { xs: 'none', sm: 'block' }, borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="secondary"
              sx={{
                "& .MuiTab-root": {
                  color: "#CED4DA",
                  "&.Mui-selected": { color: "#FFD700" }
                }
              }}
            > 
              <Tab label="Usuarios Registrados" />
              <Tab label="Agregar Invitado" />
            </Tabs>
          </Box>

          <Box sx={{ mb: 3 }}>
            {tabValue === 0 ? (
              <FormControl fullWidth>
                <InputLabel>Seleccionar Jugadores Registrados</InputLabel>
                <Select
                  multiple
                  value={selectedPlayers.filter((p): p is RegisteredPlayer => p.isRegistered).map(p => p._id)}
                  onChange={handleRegisteredPlayerSelection}
                  label="Seleccionar Jugadores Registrados"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 48 * 4.5,
                      },
                    },
                    anchorOrigin: {
                      vertical: 'bottom',
                      horizontal: 'left',
                    }
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((id) => {
                        const user = users.find(u => u._id === id);
                        return user ? (
                          <Chip key={id} label={user.username} />
                        ) : null;
                      })}
                    </Box>
                  )}
                >
                  {users.map((user) => (
                    <MenuItem
                      key={user._id}
                      value={user._id}
                      disabled={
                        selectedPlayers.length >= getMaxPlayers() &&
                        !selectedPlayers.some(p => p.isRegistered && p._id === user._id)
                      }
                    >
                      {user.username}
                      {selectedPlayers.some(p => p.isRegistered && p._id === user._id) && ' ✓'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Nombre del Invitado"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={selectedPlayers.length >= getMaxPlayers()}
                />
                <Button
                  variant="contained"
                  onClick={handleAddGuest}
                  sx={{
                    fontWeight: "bold",
                    borderRadius: 2,
                    "&:hover": {
                      bgcolor: "#8B1A1A"
                    }
                  }}
                  disabled={selectedPlayers.length >= getMaxPlayers()}
                >
                  <AddIcon />
                </Button>
              </Box>
            )}
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleCreateMatch}
            disabled={loading || selectedPlayers.length < getMaxPlayers()}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Crear Partido'}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default CreateMatch; 