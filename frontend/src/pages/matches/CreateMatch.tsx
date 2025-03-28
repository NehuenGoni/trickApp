import React, { useState, useEffect } from 'react';
import {
  Container,
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
  Delete as DeleteIcon
} from '@mui/icons-material';
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
  _id: string;
  username: string;
  isGuest: true;
}

type Player = RegisteredPlayer | GuestPlayer;

interface IMatch {
  tournament?: string; // Torneo al que pertenece
  teams: {
    teamId: string;
    score: number;
  }[]; // Equipos y sus puntajes
  winner?: string; // Equipo ganador
  status: "in_progress" | "finished";
  createdAt: Date;
}

const CreateMatch = () => {
  const navigate = useNavigate();
  const [matchType, setMatchType] = useState('pairs');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    fetchUsers();
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
      _id: `guest-${Date.now()}`,
      username: guestName.trim(),
      isGuest: true
    };

    setSelectedPlayers([...selectedPlayers, newGuest]);
    setGuestName('');
    setError('');
  };

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(player => player._id !== playerId));
  };

  const handleRegisteredPlayerSelection = (event: SelectChangeEvent<string[]>) => {
    const selectedIds = Array.isArray(event.target.value) ? event.target.value : [event.target.value];
    console.log('IDs seleccionados:', selectedIds);

    if (selectedIds.length > getMaxPlayers() - 1) {
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
    console.log('Jugadores seleccionados:', selectedRegisteredPlayers);

    const newSelectedPlayers = [
      ...selectedPlayers.filter(p => 'isGuest' in p),
      ...selectedRegisteredPlayers
    ];
    console.log('Nuevo estado de jugadores:', newSelectedPlayers);

    setSelectedPlayers(newSelectedPlayers);
    setError('');
  };

  const getMaxPlayers = () => {
    return matchType === 'pairs' ? 3 : 5; 
  };

  const handleCreateMatch = async () => {
    if (selectedPlayers.length < getMaxPlayers() - 1) {
      setError('Selecciona la cantidad correcta de jugadores');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest(API_ROUTES.MATCHES.CREATE, {
        method: 'POST',
        body: JSON.stringify({
          type: 'friendly',
          teams: [
            {
              teamId: selectedPlayers[0]._id,
              score: 0
            },
            ...selectedPlayers.slice(1).map(player => ({
              teamId: player._id,
              score: 0
            }))
          ],
          status: "in_progress"
        })
      });
      
      navigate(`/matches/scoreboard/${response._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el partido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <NavBar />
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom align="center">
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
              Jugadores Seleccionados ({selectedPlayers.length}/{getMaxPlayers() - 1})
            </Typography>
            <List>
              {selectedPlayers.map((player) => (
                <ListItem key={player._id}>
                  <ListItemText 
                    primary={player.username}
                    secondary={'isGuest' in player ? 'Invitado' : 'Registrado'}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleRemovePlayer(player._id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
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
                  value={selectedPlayers.filter(p => !('isGuest' in p)).map(p => p._id)}
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
                        selectedPlayers.length >= getMaxPlayers() - 1 &&
                        !selectedPlayers.some(p => p._id === user._id)
                      }
                    >
                      {user.username}
                      {selectedPlayers.some(p => p._id === user._id) && ' ✓'}
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
                  disabled={selectedPlayers.length >= getMaxPlayers() - 1}
                />
                <Button
                  variant="contained"
                  onClick={handleAddGuest}
                  disabled={selectedPlayers.length >= getMaxPlayers() - 1}
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
            disabled={loading || selectedPlayers.length < getMaxPlayers() - 1}
          >
            {loading ? 'Creando...' : 'Crear Partido'}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default CreateMatch; 