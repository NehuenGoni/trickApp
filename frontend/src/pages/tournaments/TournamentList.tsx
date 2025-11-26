import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface Tournament {
  _id: string;
  name: string;
  description: string;
  startDate: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  teams: Array<{
    teamId: string;
    name: string;
    players: Array<{
      name: string;
      playerId?: string;
      isGuest?: boolean;
    }>;
  }>;
  matches?: Array<{
    _id: string;
    team1: {
      teamId: string;
      score: number;
    };
    team2: {
      teamId: string;
      score: number;
    };
    phase: string;
    status: string;
  }>;
}

const TournamentList = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      console.log('Fetching tournaments from:', API_ROUTES.TOURNAMENTS.LIST);
      const data = await apiRequest(API_ROUTES.TOURNAMENTS.LIST);
      console.log('Received tournaments:', data);
      setTournaments(data);
    } catch (err: any) {
      console.error('Error fetching tournaments:', err);
      setError(err.response?.data?.message || 'Error al cargar los torneos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTournament) return;

    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.DELETE(selectedTournament), {
        method: 'DELETE'
      });
      setTournaments(tournaments.filter(t => t._id !== selectedTournament));
      setDeleteDialogOpen(false);
    } catch (err) {
      setError('Error al eliminar el torneo');
    }
  };

  const getStatusColor = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return 'info';
      case 'in_progress':
        return 'success';
      case 'completed':
        return 'default';
    }
  };

  const getStatusLabel = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return 'Próximo';
      case 'in_progress':
        return 'En Curso';
      case 'completed':
        return 'Finalizado';
    }
  };

  if (loading) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" component="h1">
              Torneos
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/tournaments/create')}
            >
              Crear Torneo
            </Button>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {tournaments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <TrophyIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography color="textSecondary" gutterBottom>
                No hay torneos creados
              </Typography>
              <Typography color="textSecondary" variant="body2" sx={{ mb: 2 }}>
                ¡Crea tu primer torneo para comenzar!
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/tournaments/create')}
              >
                Crear Torneo
              </Button>
            </Box>
          ) : (
            <List>
              {tournaments.map((tournament) => (
                <ListItem
                  key={tournament._id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {tournament.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={getStatusLabel(tournament.status)}
                          color={getStatusColor(tournament.status)}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          {tournament.description}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            size="small"
                            label={`${tournament.teams.length} equipos`}
                            sx={{ mr: 1 }}
                          />
                          <Chip
                            size="small"
                            label={`${tournament?.matches?.length} partidos`}
                          />
                        </Box>
                      </>
                    }
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      onClick={() => navigate(`/tournaments/${tournament._id}`)}
                      color="primary"
                      title="Ver detalles"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => navigate(`/tournaments/edit/${tournament._id}`)}
                      color="primary"
                      title="Editar torneo"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => {
                        setSelectedTournament(tournament._id);
                        setDeleteDialogOpen(true);
                      }}
                      color="error"
                      title="Eliminar torneo"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Confirmar Eliminación</DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Estás seguro de que deseas eliminar este torneo? Esta acción no se puede deshacer.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              Eliminar
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default TournamentList; 