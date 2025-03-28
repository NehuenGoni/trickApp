import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface Team {
  teamId: {
    _id: string;
    username: string;
  };
  score: number;
}

interface Match {
  _id: string;
  teams: Team[];
  type: 'friendly' | 'tournament';
  status: 'in_progress' | 'finished';
  createdAt: string;
  tournament?: {
    _id: string;
    name: string;
  };
}

const InProgressMatches = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const data = await apiRequest(API_ROUTES.MATCHES.LIST_IN_PROGRESS);
      setMatches(data);
    } catch (err) {
      setError('Error al cargar los partidos en curso');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMatch) return;

    try {
      await apiRequest(API_ROUTES.MATCHES.DELETE(selectedMatch), {
        method: 'DELETE'
      });
      setMatches(matches.filter(match => match._id !== selectedMatch));
      setDeleteDialogOpen(false);
    } catch (err) {
      setError('Error al eliminar el partido');
    }
  };

  const handleResume = (matchId: string) => {
    navigate(`/matches/scoreboard/${matchId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
          <Typography variant="h5" gutterBottom align="center">
            Partidos en Curso
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {matches.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary" gutterBottom>
                No hay partidos en curso
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/matches/create')}
                sx={{ mt: 2 }}
              >
                Crear Nuevo Partido
              </Button>
            </Box>
          ) : (
            <>
              <List>
                {matches.map((match) => (
                  <ListItem
                    key={match._id}
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
                            {match.teams[0]?.teamId?.username || 'Jugador Desconocido'} vs{' '}
                            {match.teams.slice(1).map(t => t.teamId?.username || 'Jugador Desconocido').join(', ')}
                          </Typography>
                          <Chip
                            size="small"
                            label={match.type === 'tournament' ? 'Torneo' : 'Amistoso'}
                            color={match.type === 'tournament' ? 'primary' : 'default'}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" component="span">
                            Creado: {formatDate(match.createdAt)}
                          </Typography>
                          {match.tournament && match.tournament.name && (
                            <Typography variant="body2" component="div">
                              Torneo: {match.tournament.name}
                            </Typography>
                          )}
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleResume(match._id)}
                        sx={{ mr: 1 }}
                        color="primary"
                        title="Reanudar partido"
                      >
                        <PlayArrowIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => {
                          setSelectedMatch(match._id);
                          setDeleteDialogOpen(true);
                        }}
                        color="error"
                        title="Eliminar partido"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/matches/create')}
                >
                  Crear Nuevo Partido
                </Button>
              </Box>
            </>
          )}
        </Paper>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Confirmar Eliminación</DialogTitle>
          <DialogContent>
            ¿Estás seguro de que deseas eliminar este partido?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              Eliminar
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default InProgressMatches; 