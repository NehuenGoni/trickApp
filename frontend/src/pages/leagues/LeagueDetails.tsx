import React, { useCallback, useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  List,
  CardActionArea,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Close as RemoveIcon,
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import TournamentLogo from '../../components/TournamentLogo';
import LeagueStandingsTable from '../../components/LeagueStandingsTable';
import LeagueTournamentPicker from '../../components/LeagueTournamentPicker';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser from '../../hooks/useCurrentUser';
import { canManageLeague } from '../../utils/leaguePermissions';
import { LeagueDetail, LeagueTournamentSummary } from '../../types/league';

const STATUS_LABEL: Record<LeagueTournamentSummary['status'], string> = {
  upcoming: 'Inscripciones abiertas',
  in_progress: 'En curso',
  completed: 'Finalizado'
};

const STATUS_STYLE: Record<LeagueTournamentSummary['status'], object> = {
  upcoming: { bgcolor: 'info.main', color: 'info.contrastText' },
  in_progress: { bgcolor: '#D4AF37', color: '#000' },
  completed: { bgcolor: 'success.main', color: 'success.contrastText' }
};

const LeagueDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useCurrentUser();

  const [data, setData] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(
    () => (location.state as { message?: string } | null)?.message || ''
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LeagueTournamentSummary | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      const result = await apiRequest(API_ROUTES.LEAGUES.DETAIL(id));
      setData(result);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la liga');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRemoveTournament = async () => {
    if (!removeTarget || !id) return;
    setRemoving(true);
    try {
      await apiRequest(API_ROUTES.LEAGUES.LEAGUE_TOURNAMENT(id, removeTarget._id), {
        method: 'DELETE'
      });
      setInfo(`"${removeTarget.name}" se quitó de la liga.`);
      await fetchDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al quitar el torneo de la liga');
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
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

  if (error && !data) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }

  if (!data) return null;

  const { league, tournaments, standings, guestCount } = data;
  const canManage = canManageLeague(user, league);

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo('')}>{info}</Alert>}

        <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
              <TournamentLogo tournament={league} size={64} logoUrlBuilder={API_ROUTES.LEAGUES.LOGO} />
              <Box>
                <Typography variant="h5" component="h1">
                  {league.name}
                </Typography>
                {league.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {league.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {new Date(league.startDate).toLocaleDateString()}
                  {league.endDate ? ` — ${new Date(league.endDate).toLocaleDateString()}` : ''}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="small"
                label={league.isActive ? 'Activa' : 'Finalizada'}
                color={league.isActive ? 'success' : 'default'}
              />
              {canManage && (
                <IconButton title="Editar liga" onClick={() => navigate(`/leagues/${league._id}/edit`)}>
                  <EditIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </Paper>

        <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Tabla de posiciones
          </Typography>
          <LeagueStandingsTable rows={standings} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            Solo cuentan los torneos finalizados de la liga.
            {guestCount > 0 &&
              ' Los jugadores invitados (sin cuenta) se agrupan por nombre; si dos invitados figuran por separado, probablemente se anotaron con variantes del nombre.'}
          </Typography>
        </Paper>

        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Torneos de la liga</Typography>
            {canManage && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setPickerOpen(true)}>
                  Agregar torneo
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/tournaments/create?league=${league._id}`)}
                >
                  Crear torneo
                </Button>
              </Box>
            )}
          </Box>

          {tournaments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <TrophyIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography color="text.secondary">Todavía no hay torneos en esta liga</Typography>
              {canManage && (
                <Button
                  sx={{ mt: 2 }}
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/tournaments/create?league=${league._id}`)}
                >
                  Crear el primer torneo
                </Button>
              )}
            </Box>
          ) : (
            <List>
              {tournaments.map((tournament) => (
                <Paper
                  key={tournament._id}
                  elevation={1}
                  sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                    <CardActionArea
                      onClick={() => navigate(`/tournaments/${tournament._id}`)}
                      sx={{ flexGrow: 1 }}
                    >
                      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <TournamentLogo tournament={tournament} size={40} />
                        <Typography sx={{ flexGrow: 1 }}>{tournament.name}</Typography>
                        <Chip
                          size="small"
                          label={STATUS_LABEL[tournament.status]}
                          sx={STATUS_STYLE[tournament.status]}
                        />
                      </Box>
                    </CardActionArea>
                    {canManage && (
                      <IconButton
                        title="Quitar de la liga"
                        onClick={() => setRemoveTarget(tournament)}
                        sx={{ color: 'error.main', alignSelf: 'center', mr: 1 }}
                      >
                        <RemoveIcon />
                      </IconButton>
                    )}
                  </Box>
                </Paper>
              ))}
            </List>
          )}
        </Paper>

        {id && (
          <LeagueTournamentPicker
            open={pickerOpen}
            leagueId={id}
            onClose={() => setPickerOpen(false)}
            onAdded={() => {
              setInfo('Torneo agregado a la liga.');
              fetchDetail();
            }}
          />
        )}

        <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)}>
          <DialogTitle>Quitar torneo de la liga</DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Querés quitar "{removeTarget?.name}" de esta liga? El torneo no se borra, solo deja
              de contar para la tabla de posiciones.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancelar
            </Button>
            <Button onClick={handleRemoveTournament} color="error" variant="contained" disabled={removing}>
              Quitar
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default LeagueDetails;
