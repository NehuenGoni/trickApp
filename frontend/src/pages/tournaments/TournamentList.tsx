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
  status: 'upcoming' | 'in_progress' | 'finished';
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

  const getStatusStyles = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return {
          bgcolor: 'info.main',
          color: 'info.contrastText',
        };
      case 'in_progress':
        return {
          bgcolor: '#D4AF37', // amarillo app
          color: '#000',
        };
      case 'finished':
        return {
          bgcolor: 'success.main',
          color: 'success.contrastText',
        };
    }
  };

  const getStatusLabel = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return 'Próximo';
      case 'in_progress':
        return 'En Curso';
      case 'finished':
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
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  mb: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1,
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {tournament.name}
                    </Typography>
                    {tournament.description && (
                      <Typography variant="body2" color="text.secondary">
                        {tournament.description}
                      </Typography>
                    )}
                  </Box>

                  <Chip
                    size="small"
                    label={getStatusLabel(tournament.status)}
                    sx={getStatusStyles(tournament.status)}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip size="small" label={`${tournament.teams.length} equipos`} />
                  <Chip size="small" label={`${tournament.matches?.length} partidos`} />
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: { xs: 'center', sm: 'flex-end' },
                    gap: 1,
                    pt: 1,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <IconButton
                    title="Ver detalles"
                    onClick={() => navigate(`/tournaments/${tournament._id}`)}
                    sx={{
                      color: '#D4AF37',
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.15)' },
                    }}
                  >
                    <ViewIcon />
                  </IconButton>

                  <IconButton 
                    title="Editar torneo"
                    sx={{
                      color: '#4f49cd',
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.15)' },
                    }}
                   onClick={() => navigate(`/tournaments/${tournament._id}/edit`)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    title="Eliminar torneo"
                    disabled={tournament.status === 'finished'}
                    onClick={() => {
                      setSelectedTournament(tournament._id);
                      setDeleteDialogOpen(true);
                    }}
                    sx={{
                      color: 'error.main',
                      '&:hover': { backgroundColor: 'rgba(211,47,47,0.15)' },
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Paper>
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