import React, { useEffect, useState } from 'react';
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
  Leaderboard as LeagueIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import SurfaceCard from '../../components/SurfaceCard';
import TournamentLogo from '../../components/TournamentLogo';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser from '../../hooks/useCurrentUser';
import useBilling from '../../hooks/useBilling';
import { canManageLeague, canManageLeagues } from '../../utils/leaguePermissions';
import { LeagueListItem } from '../../types/league';

const LeagueList = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { billing } = useBilling();
  const canCreate = canManageLeagues(user);
  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LeagueListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    try {
      const data = await apiRequest(API_ROUTES.LEAGUES.LIST);
      setLeagues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las ligas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const data = await apiRequest(API_ROUTES.LEAGUES.DELETE(deleteTarget._id), {
        method: 'DELETE'
      });
      setLeagues((prev) => prev.filter((l) => l._id !== deleteTarget._id));
      setSuccess(data?.message || 'Liga eliminada con éxito');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la liga');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const formatRange = (league: LeagueListItem) => {
    const start = new Date(league.startDate).toLocaleDateString();
    if (!league.endDate) return `Desde ${start}`;
    return `${start} — ${new Date(league.endDate).toLocaleDateString()}`;
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
        <SurfaceCard>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" component="h1" sx={{ color: '#FFD700', fontWeight: 700 }}>
              Ligas
            </Typography>
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/leagues/create')}
              >
                Crear Liga
              </Button>
            )}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          {leagues.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LeagueIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography color="textSecondary" gutterBottom>
                No hay ligas creadas
              </Typography>
              {canCreate && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/leagues/create')}
                  sx={{ mt: 1 }}
                >
                  Crear Liga
                </Button>
              )}
            </Box>
          ) : (
            <List>
              {leagues.map((league) => (
                <Paper
                  key={league._id}
                  elevation={1}
                  sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
                >
                  <CardActionArea onClick={() => navigate(`/leagues/${league._id}`)}>
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1 }}>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                          <TournamentLogo
                            tournament={league}
                            size={48}
                            logoUrlBuilder={API_ROUTES.LEAGUES.LOGO}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {league.name}
                            </Typography>
                            {league.description && (
                              <Typography variant="body2" color="text.secondary">
                                {league.description}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {formatRange(league)}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          size="small"
                          label={league.isActive ? 'Activa' : 'Finalizada'}
                          color={league.isActive ? 'success' : 'default'}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={`${league.tournamentCount} torneo(s)`} />
                        <Chip size="small" label={`${league.completedCount} finalizado(s)`} />
                        <Chip
                          size="small"
                          label={`${league.playerCount} jugador(es)`}
                          title={
                            league.guestCount > 0
                              ? `${league.registeredCount} registrados · ${league.guestCount} invitados`
                              : undefined
                          }
                        />
                        {league.createdBy === user?._id && billing?.limits.maxMembers != null && (
                          <Chip
                            size="small"
                            label={`${league.playerCount} de ${billing.limits.maxMembers} del plan`}
                            color={
                              league.playerCount > billing.limits.maxMembers
                                ? 'error'
                                : league.playerCount === billing.limits.maxMembers
                                ? 'warning'
                                : 'default'
                            }
                          />
                        )}
                      </Box>
                    </Box>
                  </CardActionArea>

                  {canManageLeague(user, league) && (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: { xs: 'center', sm: 'flex-end' },
                        gap: 1,
                        px: 2,
                        py: 1,
                        borderTop: 1,
                        borderColor: 'divider'
                      }}
                    >
                      <IconButton
                        title="Editar liga"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/leagues/${league._id}/edit`);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        title="Eliminar liga"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(league);
                        }}
                        sx={{ color: 'error.main', '&:hover': { backgroundColor: 'rgba(211,47,47,0.15)' } }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  )}
                </Paper>
              ))}
            </List>
          )}
        </SurfaceCard>

        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Estás seguro de que querés eliminar la liga "{deleteTarget?.name}"? Sus torneos{' '}
              <strong>no se borran</strong>, solo quedan sin liga. Esta acción no se puede deshacer.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
              Eliminar
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default LeagueList;
