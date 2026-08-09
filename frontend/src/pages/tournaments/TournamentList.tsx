import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  List,
  IconButton,
  CardActionArea,
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
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import SurfaceCard from '../../components/SurfaceCard';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser from '../../hooks/useCurrentUser';
import TournamentLogo from '../../components/TournamentLogo';
import { TournamentLogoMeta, TeamFormationMode, poolBasedMode } from '../../types/tournament';
import { LeagueRef } from '../../types/league';

interface Tournament {
  _id: string;
  name: string;
  logo?: TournamentLogoMeta | null;
  description: string;
  startDate: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  type?: 'grand-slam' | 'master-1000';
  format?: 'duos' | 'trios';
  teamFormationMode?: TeamFormationMode;
  league?: LeagueRef | null;
  teams: Array<{
    teamId: string;
    name: string;
    isDrawn?: boolean;
    players: Array<{
      name: string;
      playerId?: string;
      isGuest?: boolean;
    }>;
  }>;
  individualSignups?: Array<{ userId: string; name: string }>;
  matches?: string[];
}

const TournamentList = () => {
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
      // El endpoint público solo deja borrar al creador y nunca un torneo en
      // curso; el de admin no tiene esos límites y hace la misma cascada.
      const url = isAdmin
        ? API_ROUTES.ADMIN.TOURNAMENT(selectedTournament)
        : API_ROUTES.TOURNAMENTS.DELETE(selectedTournament);
      // El backend detalla en `message` cuántos partidos tocó la cascada. Si el
      // torneo pertenecía a una liga, esta se corrige sola (standings derivados).
      const data = await apiRequest(url, { method: 'DELETE' });
      setTournaments(tournaments.filter(t => t._id !== selectedTournament));
      setSuccess(data?.message || 'Torneo eliminado con éxito');
      setError('');
      setDeleteDialogOpen(false);
    } catch (err: any) {
      // `apiRequest` lanza un Error con el mensaje del backend (por ejemplo,
      // el rechazo al borrar un torneo en curso), así que hay que mostrarlo.
      setError(err?.message || 'Error al eliminar el torneo');
      setSuccess('');
      setDeleteDialogOpen(false);
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
          bgcolor: '#D4AF37',
          color: '#000',
        };
      case 'completed':
        return {
          bgcolor: 'success.main',
          color: 'success.contrastText',
        };
    }
  };

  const getStatusLabel = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return 'Inscripciones abiertas';
      case 'in_progress':
        return 'En Curso';
      case 'completed':
        return 'Finalizado';
    }
  };

  const getCapacityLabel = (t: Tournament) => {
    const teamSize = t.format === 'trios' ? 3 : 2;
    if (t.teamFormationMode && poolBasedMode(t.teamFormationMode)) {
      // Los equipos derivados del pool (isDrawn) no se suman aparte: sus
      // jugadores ya están contados en individualSignups. Espejo de
      // `slotsFilled` en TournamentDetails.tsx.
      const fixedTeams = (t.teams || []).filter((team) => !team.isDrawn).length;
      const filled = (t.individualSignups?.length || 0) + fixedTeams * teamSize;
      return `${filled}/${8 * teamSize} jugadores`;
    }
    return `${t.teams?.length || 0}/8 equipos`;
  };

  const getTypeLabel = (type?: Tournament['type']) =>
    type === 'grand-slam' ? 'Grand Slam' : type === 'master-1000' ? 'Master 1000' : '';

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
        <SurfaceCard>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" component="h1" sx={{ color: '#FFD700', fontWeight: 700 }}>
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

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

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
                key={tournament._id}
                elevation={1}
                sx={{
                  mb: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <CardActionArea onClick={() => navigate(`/tournaments/${tournament._id}`)}>
                  <Box sx={{ p: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                        <TournamentLogo tournament={tournament} size={48} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {tournament.name}
                          </Typography>
                          {tournament.description && (
                            <Typography variant="body2" color="text.secondary">
                              {tournament.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Chip
                        size="small"
                        label={getStatusLabel(tournament.status)}
                        sx={getStatusStyles(tournament.status)}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {tournament.type && (
                        <Chip size="small" label={getTypeLabel(tournament.type)} />
                      )}
                      {tournament.format && (
                        <Chip
                          size="small"
                          label={tournament.format === 'duos' ? 'Duos' : 'Tríos'}
                        />
                      )}
                      <Chip size="small" label={getCapacityLabel(tournament)} />
                      <Chip size="small" label={`${tournament.matches?.length || 0} partidos`} />
                      {tournament.league && (
                        <Chip size="small" label={`Liga: ${tournament.league.name}`} color="secondary" />
                      )}
                    </Box>
                  </Box>
                </CardActionArea>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: { xs: 'center', sm: 'flex-end' },
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <IconButton
                    title="Editar torneo"
                    sx={{
                      color: '#4f49cd',
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.15)' },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/tournaments/${tournament._id}/edit`);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    title="Eliminar torneo"
                    disabled={!isAdmin && tournament.status === 'completed'}
                    onClick={(e) => {
                      e.stopPropagation();
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
        </SurfaceCard>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Confirmar Eliminación</DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Estás seguro de que deseas eliminar este torneo? Se borran también sus partidos,
              el cuadro y las estadísticas, y se descuentan los puntos que haya otorgado al
              ranking. Esta acción no se puede deshacer.
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