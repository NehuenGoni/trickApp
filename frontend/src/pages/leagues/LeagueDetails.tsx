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
  DialogActions,
  Autocomplete,
  TextField,
  Avatar
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Close as RemoveIcon,
  EmojiEvents as TrophyIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import TournamentLogo from '../../components/TournamentLogo';
import LeagueStandingsTable from '../../components/LeagueStandingsTable';
import LeagueTournamentPicker from '../../components/LeagueTournamentPicker';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser from '../../hooks/useCurrentUser';
import useBilling from '../../hooks/useBilling';
import { canManageLeague } from '../../utils/leaguePermissions';
import { LeagueDetail, LeagueOrganizer, LeagueTournamentSummary } from '../../types/league';

interface UserOption {
  _id: string;
  username: string;
}

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
  const { billing } = useBilling();

  const [data, setData] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(
    () => (location.state as { message?: string } | null)?.message || ''
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LeagueTournamentSummary | null>(null);
  const [removing, setRemoving] = useState(false);

  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedOrganizer, setSelectedOrganizer] = useState<UserOption | null>(null);
  const [addingOrganizer, setAddingOrganizer] = useState(false);
  const [removingOrganizerId, setRemovingOrganizerId] = useState<string | null>(null);

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

  const searchUsers = async (q: string) => {
    if (!q.trim()) {
      setUserOptions([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const result = await apiRequest(API_ROUTES.USERS.SEARCH(q));
      setUserOptions(result || []);
    } catch {
      setUserOptions([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleAddOrganizer = async () => {
    if (!selectedOrganizer || !id) return;
    setAddingOrganizer(true);
    try {
      await apiRequest(API_ROUTES.LEAGUES.ORGANIZERS(id), {
        method: 'POST',
        body: JSON.stringify({ userId: selectedOrganizer._id })
      });
      setSelectedOrganizer(null);
      setUserOptions([]);
      await fetchDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar el organizador');
    } finally {
      setAddingOrganizer(false);
    }
  };

  const handleRemoveOrganizer = async (organizer: LeagueOrganizer) => {
    if (!id) return;
    setRemovingOrganizerId(organizer._id);
    try {
      await apiRequest(API_ROUTES.LEAGUES.ORGANIZER(id, organizer._id), { method: 'DELETE' });
      await fetchDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al quitar el organizador');
    } finally {
      setRemovingOrganizerId(null);
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
  // El medidor de uso es del PLAN DEL DUEÑO, no de quien mira la página: un
  // organizador tiene su propio billing (o ninguno), que no tiene nada que
  // ver con el cupo de esta liga. Solo tiene sentido mostrárselo al dueño.
  const isOwner = !!user && user._id === league.createdBy;

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

        {isOwner && billing && billing.plan !== 'free' && (
          <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Tu plan: {billing.plan === 'basico' ? 'Básico' : billing.plan === 'club' ? 'Club' : 'Pro'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Torneos este mes</Typography>
                <Typography variant="h6">
                  {billing.usage.tournamentsCreated}
                  {billing.limits.tournamentsPerMonth !== null && ` de ${billing.limits.tournamentsPerMonth}`}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Jugadores registrados</Typography>
                <Typography
                  variant="h6"
                  color={
                    billing.limits.maxMembers !== null &&
                    standings.filter((s) => !s.isGuest).length > billing.limits.maxMembers
                      ? 'error'
                      : 'text.primary'
                  }
                >
                  {standings.filter((s) => !s.isGuest).length}
                  {billing.limits.maxMembers !== null && ` de ${billing.limits.maxMembers}`}
                </Typography>
              </Box>
            </Box>
            {billing.limits.maxMembers !== null &&
              standings.filter((s) => !s.isGuest).length > billing.limits.maxMembers && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Superaste el cupo de jugadores de tu plan. Las inscripciones siguen funcionando igual;
                  pasate a un plan superior cuando quieras destrabar el resto de los beneficios.{' '}
                  <Button size="small" onClick={() => navigate('/planes')}>Ver planes</Button>
                </Alert>
              )}
            {!billing.isActive && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Tu suscripción venció. Podés seguir gestionando tus torneos en curso, pero no crear uno nuevo
                hasta reactivarla.{' '}
                <Button size="small" onClick={() => navigate('/planes')}>Ver planes</Button>
              </Alert>
            )}
          </Paper>
        )}

        {canManage && (
          <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Organizadores
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Pueden sortear, iniciar y cargar resultados de los torneos de esta liga con los
              mismos permisos que vos, aunque no las hayan creado ellos.
            </Typography>

            {league.organizers.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Todavía no designaste ningún organizador.
              </Typography>
            ) : (
              <List sx={{ mb: 2 }}>
                {league.organizers.map((organizer) => (
                  <Box
                    key={organizer._id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      borderBottom: 1,
                      borderColor: 'divider'
                    }}
                  >
                    <Avatar sx={{ width: 32, height: 32 }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Typography sx={{ flexGrow: 1 }}>{organizer.username}</Typography>
                    <IconButton
                      title="Quitar organizador"
                      size="small"
                      onClick={() => handleRemoveOrganizer(organizer)}
                      disabled={removingOrganizerId === organizer._id}
                      sx={{ color: 'error.main' }}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </List>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Autocomplete
                sx={{ flexGrow: 1 }}
                size="small"
                options={userOptions}
                loading={searchingUsers}
                getOptionLabel={(o) => o.username}
                value={selectedOrganizer}
                onChange={(_, v) => setSelectedOrganizer(v)}
                onInputChange={(_, v) => searchUsers(v)}
                isOptionEqualToValue={(o, v) => o._id === v._id}
                renderInput={(params) => (
                  <TextField {...params} label="Buscar usuario para agregar" />
                )}
              />
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                disabled={!selectedOrganizer || addingOrganizer}
                onClick={handleAddOrganizer}
              >
                Agregar
              </Button>
            </Box>
          </Paper>
        )}

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
