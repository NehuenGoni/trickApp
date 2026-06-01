import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { isEmpty } from 'lodash';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface PlayerLite {
  playerId?: string;
  username?: string;
  name?: string;
  isGuest?: boolean;
}

interface MatchTeam {
  teamId: string;
  score: number;
  players: PlayerLite[];
}

interface Match {
  _id: string;
  tournament: string;
  teams: MatchTeam[];
  winner?: string;
  losingTeam?: string;
  phase: string;
  status: string;
  bracketSlot?: string;
}

interface Team {
  teamId: string;
  name: string;
  registeredBy?: string;
  players: Array<{
    name: string;
    playerId?: string;
    isGuest?: boolean;
  }>;
}

interface Signup {
  userId: string;
  name: string;
}

interface PlayerStat {
  playerId?: string;
  name: string;
  isGuest: boolean;
  position: number;
  points: number;
}

interface Tournament {
  _id: string;
  name: string;
  description: string;
  startDate: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  type: 'grand-slam' | 'master-1000';
  format: 'duos' | 'trios';
  teamFormationMode: 'user-formed' | 'random';
  createdBy: string;
  teams: Team[];
  individualSignups: Signup[];
  matches: string[];
  playerStats: PlayerStat[];
  pointsAwarded: boolean;
}

interface UserOption {
  _id: string;
  username: string;
}

const TEAM_SIZE: Record<Tournament['format'], number> = { duos: 2, trios: 3 };

const PHASE_LABELS: Record<string, string> = {
  'quarter-finals': 'Cuartos de Final',
  'semifinals-gold': 'Semifinales de Oro',
  'semifinals': 'Semifinales de Plata',
  'final-gold': 'Final Oro',
  'final': 'Final Plata',
  'third-place': 'Match por 3°/4° puesto',
  'seventh-place': 'Match por 7°/8° puesto'
};

const PHASE_ORDER = [
  'quarter-finals',
  'semifinals-gold',
  'semifinals',
  'final-gold',
  'final',
  'third-place',
  'seventh-place'
];

const TournamentDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const currentUserId = localStorage.getItem('userId') || '';

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerTeamName, setRegisterTeamName] = useState('');
  const [registerMembers, setRegisterMembers] = useState<UserOption[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [guestOpen, setGuestOpen] = useState(false);
  const [guestTeamName, setGuestTeamName] = useState('');
  const [guestNames, setGuestNames] = useState<string[]>([]);

  const [creatorAddTeamOpen, setCreatorAddTeamOpen] = useState(false);
  const [creatorAddTeamName, setCreatorAddTeamName] = useState('');
  const [creatorAddTeamMembers, setCreatorAddTeamMembers] = useState<UserOption[]>([]);
  const [creatorAddTeamGuests, setCreatorAddTeamGuests] = useState<string[]>([]);
  const [creatorAddTeamOptions, setCreatorAddTeamOptions] = useState<UserOption[]>([]);
  const [searchingCreatorUsers, setSearchingCreatorUsers] = useState(false);

  const [creatorAddPlayerOpen, setCreatorAddPlayerOpen] = useState(false);
  const [creatorPlayerOptions, setCreatorPlayerOptions] = useState<UserOption[]>([]);
  const [creatorSelectedPlayers, setCreatorSelectedPlayers] = useState<UserOption[]>([]);
  const [searchingCreatorPlayer, setSearchingCreatorPlayer] = useState(false);

  const [startOpen, setStartOpen] = useState(false);
  const [startMode, setStartMode] = useState<'random' | 'manual' | null>(null);
  const [pairings, setPairings] = useState<Record<string, [string, string]>>({
    QF1: ['', ''],
    QF2: ['', ''],
    QF3: ['', ''],
    QF4: ['', '']
  });

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const tData = await apiRequest(API_ROUTES.TOURNAMENTS.GET(id));
      setTournament(tData);
      const mData = await apiRequest(API_ROUTES.MATCHES.GET_BY_TOURNAMENT(id));
      setMatches(mData);
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al cargar el torneo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isCreator = !!tournament && tournament.createdBy === currentUserId;
  const teamSize = tournament ? TEAM_SIZE[tournament.format] : 2;
  const targetIndividuals = tournament ? 8 * TEAM_SIZE[tournament.format] : 16;

  const userIsRegistered = (() => {
    if (!tournament) return false;
    if (tournament.teamFormationMode === 'random') {
      return tournament.individualSignups.some((s) => s.userId === currentUserId);
    }
    return tournament.teams.some((t) =>
      t.players.some((p) => p.playerId === currentUserId)
    );
  })();

  const slotsFilled = (() => {
    if (!tournament) return 0;
    if (tournament.teamFormationMode === 'random') {
      return (
        tournament.individualSignups.length + tournament.teams.length * teamSize
      );
    }
    return tournament.teams.length;
  })();

  const totalSlots = tournament
    ? tournament.teamFormationMode === 'random'
      ? targetIndividuals
      : 8
    : 0;

  const cupCompletos = tournament
    ? tournament.teamFormationMode === 'random'
      ? slotsFilled === targetIndividuals
      : tournament.teams.length === 8
    : false;

  const searchUsers = async (q: string) => {
    if (!q.trim()) {
      setUserOptions([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const data = await apiRequest(API_ROUTES.USERS.SEARCH(q));
      setUserOptions(data || []);
    } catch {
      setUserOptions([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleRegister = async () => {
    if (!tournament || !id) return;
    setError('');
    try {
      if (tournament.teamFormationMode === 'random') {
        await apiRequest(API_ROUTES.TOURNAMENTS.REGISTER(id), { method: 'POST' });
      } else {
        if (!registerTeamName.trim()) {
          setError('Ingresá el nombre del equipo');
          return;
        }
        const ids = [currentUserId, ...registerMembers.map((m) => m._id)];
        if (ids.length !== teamSize) {
          setError(`Faltan integrantes: ${ids.length}/${teamSize}`);
          return;
        }
        await apiRequest(API_ROUTES.TOURNAMENTS.REGISTER(id), {
          method: 'POST',
          body: JSON.stringify({
            teamName: registerTeamName,
            memberUserIds: ids
          })
        });
      }
      setRegisterOpen(false);
      setRegisterTeamName('');
      setRegisterMembers([]);
      setInfo('Inscripción registrada');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error en la inscripción');
    }
  };

  const handleUnregister = async () => {
    if (!id) return;
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.REGISTER(id), { method: 'DELETE' });
      setInfo('Te desinscribiste del torneo');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al desinscribirse');
    }
  };

  const handleAddGuestTeam = async () => {
    if (!id || !tournament) return;
    if (!guestTeamName.trim()) {
      setError('Ingresá el nombre del equipo de invitados');
      return;
    }
    if (guestNames.filter((n) => n.trim()).length !== teamSize) {
      setError(`Necesitás ${teamSize} nombres de invitados`);
      return;
    }
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.ADD_GUEST_TEAM(id), {
        method: 'POST',
        body: JSON.stringify({
          name: guestTeamName,
          members: guestNames
            .filter((n) => n.trim())
            .map((n) => ({ name: n, isGuest: true }))
        })
      });
      setGuestOpen(false);
      setGuestTeamName('');
      setGuestNames([]);
      setInfo('Equipo de invitados agregado');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al agregar equipo de invitados');
    }
  };

  const searchCreatorUsers = async (q: string, setter: (v: UserOption[]) => void, loadingSetter: (v: boolean) => void) => {
    if (!q.trim()) { setter([]); return; }
    loadingSetter(true);
    try {
      const data = await apiRequest(API_ROUTES.USERS.SEARCH(q));
      setter(data || []);
    } catch {
      setter([]);
    } finally {
      loadingSetter(false);
    }
  };

  const handleCreatorAddTeam = async () => {
    if (!id || !tournament) return;
    setError('');
    const registeredIds = creatorAddTeamMembers.map((m) => m._id);
    const guestList = creatorAddTeamGuests.filter((g) => g.trim());
    if (!creatorAddTeamName.trim()) { setError('Ingresá un nombre de equipo'); return; }
    if (registeredIds.length + guestList.length !== teamSize) {
      setError(`El equipo debe tener ${teamSize} integrantes`);
      return;
    }
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.ADD_TEAM(id), {
        method: 'POST',
        body: JSON.stringify({
          name: creatorAddTeamName,
          members: [
            ...creatorAddTeamMembers.map((m) => ({ name: m.username, playerId: m._id, isGuest: false })),
            ...guestList.map((g) => ({ name: g, isGuest: true }))
          ]
        })
      });
      setCreatorAddTeamOpen(false);
      setCreatorAddTeamName('');
      setCreatorAddTeamMembers([]);
      setCreatorAddTeamGuests([]);
      setInfo('Equipo agregado');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al agregar el equipo');
    }
  };

  const handleCreatorRemoveTeam = async (teamId: string) => {
    if (!id) return;
    try {
      await apiRequest(`${API_ROUTES.TOURNAMENTS.ADD_TEAM(id)}/${teamId}`, { method: 'DELETE' });
      setInfo('Equipo eliminado');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al eliminar el equipo');
    }
  };

  const handleCreatorAddPlayer = async () => {
    if (!id || creatorSelectedPlayers.length === 0) return;
    setError('');
    try {
      for (const player of creatorSelectedPlayers) {
        await apiRequest(API_ROUTES.TOURNAMENTS.SIGNUP_ADMIN(id), {
          method: 'POST',
          body: JSON.stringify({ userId: player._id })
        });
      }
      setCreatorAddPlayerOpen(false);
      setCreatorSelectedPlayers([]);
      setCreatorPlayerOptions([]);
      setInfo(`${creatorSelectedPlayers.map((p) => p.username).join(', ')} inscripto${creatorSelectedPlayers.length > 1 ? 's' : ''}`);
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al inscribir el jugador');
    }
  };

  const handleCreatorRemovePlayer = async (userId: string) => {
    if (!id) return;
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.SIGNUP_ADMIN_REMOVE(id, userId), { method: 'DELETE' });
      setInfo('Jugador quitado');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al quitar el jugador');
    }
  };

  const handleStart = async () => {
    if (!id || !tournament || !startMode) return;
    try {
      const body: { mode: string; pairings?: Array<{ slot: string; teamIds: string[] }> } = {
        mode: startMode
      };
      if (startMode === 'manual') {
        const arr = (['QF1', 'QF2', 'QF3', 'QF4'] as const).map((s) => ({
          slot: s,
          teamIds: pairings[s]
        }));
        if (arr.some((e) => !e.teamIds[0] || !e.teamIds[1])) {
          setError('Completá todos los slots de los cuartos');
          return;
        }
        body.pairings = arr;
      }
      await apiRequest(API_ROUTES.TOURNAMENTS.START(id), {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setStartOpen(false);
      setStartMode(null);
      setInfo('Torneo iniciado');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al iniciar el torneo');
    }
  };

  const handlePlay = (matchId: string) => navigate(`/matches/scoreboard/${matchId}`);

  const isUserInMatch = (m: Match) =>
    m.teams.some((t) => t.players.some((p) => p.playerId === currentUserId));

  const renderParticipants = (teamId: string) => {
    const team = tournament?.teams.find((t) => t.teamId === teamId);
    if (!team || team.players.length === 0) return null;
    return (
      <Box>
        {team.players.map((p, i) => (
          <Typography
            key={p.playerId || `${teamId}-${i}`}
            sx={{
              fontSize: { xs: '0.75rem', sm: '0.85rem' },
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {p.name}
          </Typography>
        ))}
      </Box>
    );
  };

  const renderTeamName = (teamId: string) =>
    tournament?.teams.find((t) => t.teamId === teamId)?.name;

  const renderMatchCard = (match: Match) => {
    const userInMatch = isUserInMatch(match);
    const pending = match.status === 'pending' || match.teams.length < 2;

    return (
      <Grid item xs={12} key={match._id}>
        <Paper sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {pending
                ? 'A definir'
                : `${match.teams[0]?.score ?? 0} - ${match.teams[1]?.score ?? 0}`}
            </Typography>
            <Chip
              label={
                match.status === 'in_progress'
                  ? 'En progreso'
                  : match.status === 'finished'
                  ? 'Finalizado'
                  : 'Pendiente'
              }
              color={
                match.status === 'in_progress'
                  ? 'warning'
                  : match.status === 'finished'
                  ? 'success'
                  : 'default'
              }
              size="small"
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            {[0, 1].map((idx) => {
              const t = match.teams[idx];
              return (
                <Box key={idx}>
                  <Typography sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem' } }}>
                    {t ? renderTeamName(t.teamId) : 'A definir'}
                  </Typography>
                  {t && renderParticipants(t.teamId)}
                </Box>
              );
            })}
          </Box>

          {userInMatch && match.status === 'in_progress' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={() => handlePlay(match._id)}
                sx={{
                  backgroundColor: '#fbc02d',
                  color: '#000',
                  fontWeight: 'bold',
                  '&:hover': { backgroundColor: '#D4AF37' }
                }}
              >
                Jugar
              </Button>
            </Box>
          )}
        </Paper>
      </Grid>
    );
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

  if (!tournament) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error">Torneo no encontrado</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            {tournament.name}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

          <Box sx={{ mb: 3 }}>
            {tournament.description && (
              <Typography variant="body1" color="text.secondary">
                {tournament.description}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Fecha: {new Date(tournament.startDate).toLocaleDateString()}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={
                  tournament.status === 'upcoming'
                    ? 'Inscripciones abiertas'
                    : tournament.status === 'in_progress'
                    ? 'En curso'
                    : 'Finalizado'
                }
                color={
                  tournament.status === 'upcoming'
                    ? 'info'
                    : tournament.status === 'in_progress'
                    ? 'warning'
                    : 'success'
                }
              />
              <Chip
                size="small"
                label={tournament.type === 'grand-slam' ? 'Grand Slam' : 'Master 1000'}
              />
              <Chip size="small" label={tournament.format === 'duos' ? 'Duos' : 'Tríos'} />
              <Chip
                size="small"
                label={
                  tournament.teamFormationMode === 'user-formed'
                    ? 'Equipos por jugadores'
                    : 'Equipos aleatorios'
                }
              />
              <Chip size="small" label={`${slotsFilled}/${totalSlots}`} />
            </Box>
          </Box>

          {tournament.status === 'upcoming' && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Inscripciones
              </Typography>

              {tournament.teamFormationMode === 'random' ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Inscriptos ({tournament.individualSignups.length + tournament.teams.length * teamSize}/{totalSlots}):
                  </Typography>
                  {tournament.individualSignups.length === 0 && tournament.teams.length === 0 ? (
                    <Typography variant="body2">Aún no hay inscriptos.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {tournament.individualSignups.map((s) => (
                        <Chip
                          key={s.userId}
                          size="small"
                          label={s.name}
                          onDelete={isCreator ? () => handleCreatorRemovePlayer(s.userId) : undefined}
                        />
                      ))}
                      {tournament.teams.map((t) =>
                        t.players.map((p, i) => (
                          <Chip
                            key={p.playerId || `${t.teamId}-${i}`}
                            size="small"
                            label={p.name}
                          />
                        ))
                      )}
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Equipos ({tournament.teams.length}/8):
                  </Typography>
                  {tournament.teams.length === 0 ? (
                    <Typography variant="body2">Aún no hay equipos inscriptos.</Typography>
                  ) : (
                    tournament.teams.map((t) => (
                      <Paper key={t.teamId} variant="outlined" sx={{ p: 1, my: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle2">{t.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t.players.map((p) => p.name).join(', ')}
                          </Typography>
                        </Box>
                        {isCreator && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleCreatorRemoveTeam(t.teamId)}
                          >
                            Quitar
                          </Button>
                        )}
                      </Paper>
                    ))
                  )}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                {!userIsRegistered && slotsFilled < totalSlots && (
                  <Button variant="contained" onClick={() => setRegisterOpen(true)}>
                    Inscribirme
                  </Button>
                )}
                {userIsRegistered && (
                  <Button variant="outlined" color="error" onClick={handleUnregister}>
                    Desinscribirme
                  </Button>
                )}
                {isCreator && slotsFilled < totalSlots && tournament.teamFormationMode === 'user-formed' && (
                  <Button variant="outlined" onClick={() => setCreatorAddTeamOpen(true)}>
                    Agregar equipo
                  </Button>
                )}
                {isCreator && slotsFilled < totalSlots && tournament.teamFormationMode === 'random' && (
                  <Button variant="outlined" onClick={() => setCreatorAddPlayerOpen(true)}>
                    Agregar jugador
                  </Button>
                )}
                {isCreator && slotsFilled < totalSlots && (
                  <Button variant="outlined" onClick={() => setGuestOpen(true)}>
                    Agregar invitados
                  </Button>
                )}
                {isCreator && (
                  <Button
                    variant="contained"
                    color="success"
                    disabled={!cupCompletos}
                    onClick={() => setStartOpen(true)}
                  >
                    Iniciar torneo
                  </Button>
                )}
              </Box>
            </Paper>
          )}

          {tournament.status === 'completed' && tournament.playerStats.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Ranking de jugadores
              </Typography>
              {[...tournament.playerStats]
                .sort((a, b) => a.position - b.position)
                .map((s, i) => (
                  <Box
                    key={`${s.playerId || s.name}-${i}`}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      py: 0.5
                    }}
                  >
                    <Typography>
                      {s.position}° — {s.name} {s.isGuest && '(invitado)'}
                    </Typography>
                    <Typography fontWeight="bold">{s.points} pts</Typography>
                  </Box>
                ))}
            </Paper>
          )}

          {matches.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h5" gutterBottom>
                Partidos del torneo
              </Typography>

              {PHASE_ORDER.map((phase) => {
                const phaseMatches = matches.filter((m) => m.phase === phase);
                if (isEmpty(phaseMatches)) return null;
                return (
                  <Box sx={{ mb: 2 }} key={phase}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography fontWeight="bold">{PHASE_LABELS[phase]}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={3}>
                          {phaseMatches.map(renderMatchCard)}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                );
              })}
            </>
          )}
        </Paper>

        <Dialog
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Inscribirme al torneo</DialogTitle>
          <DialogContent>
            {tournament.teamFormationMode === 'random' ? (
              <Typography>
                Te vas a inscribir individualmente. El sistema sortea los equipos al iniciar
                el torneo.
              </Typography>
            ) : (
              <Box>
                <TextField
                  fullWidth
                  label="Nombre del equipo"
                  value={registerTeamName}
                  onChange={(e) => setRegisterTeamName(e.target.value)}
                  margin="normal"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Vos ya estás incluido. Elegí los otros {teamSize - 1}{' '}
                  {teamSize === 2 ? 'compañero' : 'compañeros'}.
                </Typography>
                <Autocomplete
                  multiple
                  options={userOptions}
                  loading={searchingUsers}
                  getOptionLabel={(o) => o.username}
                  value={registerMembers}
                  onChange={(_, v) => {
                    if (v.length <= teamSize - 1) setRegisterMembers(v);
                  }}
                  onInputChange={(_, v) => searchUsers(v)}
                  isOptionEqualToValue={(o, v) => o._id === v._id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={`Compañeros (${registerMembers.length}/${teamSize - 1})`}
                      margin="normal"
                    />
                  )}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRegisterOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleRegister}>
              Inscribirme
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={guestOpen}
          onClose={() => setGuestOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Agregar equipo de invitados</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Nombre del equipo"
              value={guestTeamName}
              onChange={(e) => setGuestTeamName(e.target.value)}
              margin="normal"
            />
            {Array.from({ length: teamSize }).map((_, i) => (
              <TextField
                key={i}
                fullWidth
                label={`Nombre del invitado ${i + 1}`}
                value={guestNames[i] || ''}
                onChange={(e) => {
                  const arr = [...guestNames];
                  arr[i] = e.target.value;
                  setGuestNames(arr);
                }}
                margin="normal"
              />
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGuestOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleAddGuestTeam}>
              Agregar
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={creatorAddTeamOpen}
          onClose={() => { setCreatorAddTeamOpen(false); setCreatorAddTeamName(''); setCreatorAddTeamMembers([]); setCreatorAddTeamGuests([]); }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Agregar equipo (como creador)</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Nombre del equipo"
              value={creatorAddTeamName}
              onChange={(e) => setCreatorAddTeamName(e.target.value)}
              margin="normal"
            />
            <Autocomplete
              multiple
              options={creatorAddTeamOptions}
              loading={searchingCreatorUsers}
              getOptionLabel={(o) => o.username}
              value={creatorAddTeamMembers}
              onChange={(_, v) => { if (v.length <= teamSize) setCreatorAddTeamMembers(v); }}
              onInputChange={(_, v) => searchCreatorUsers(v, setCreatorAddTeamOptions, setSearchingCreatorUsers)}
              isOptionEqualToValue={(o, v) => o._id === v._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`Jugadores registrados (${creatorAddTeamMembers.length} elegidos)`}
                  margin="normal"
                  helperText={`Podés combinar jugadores registrados con invitados hasta completar ${teamSize}`}
                />
              )}
            />
            {Array.from({ length: Math.max(0, teamSize - creatorAddTeamMembers.length) }).map((_, i) => (
              <TextField
                key={i}
                fullWidth
                label={`Invitado ${i + 1} (nombre)`}
                value={creatorAddTeamGuests[i] || ''}
                onChange={(e) => {
                  const arr = [...creatorAddTeamGuests];
                  arr[i] = e.target.value;
                  setCreatorAddTeamGuests(arr);
                }}
                margin="dense"
              />
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setCreatorAddTeamOpen(false); setCreatorAddTeamName(''); setCreatorAddTeamMembers([]); setCreatorAddTeamGuests([]); }}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleCreatorAddTeam}>
              Agregar
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={creatorAddPlayerOpen}
          onClose={() => { setCreatorAddPlayerOpen(false); setCreatorSelectedPlayers([]); setCreatorPlayerOptions([]); }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Agregar jugadores al torneo</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
              Podés seleccionar varios jugadores a la vez.
            </Typography>
            <Autocomplete
              multiple
              options={creatorPlayerOptions}
              loading={searchingCreatorPlayer}
              getOptionLabel={(o) => o.username}
              value={creatorSelectedPlayers}
              onChange={(_, v) => setCreatorSelectedPlayers(v)}
              onInputChange={(_, v) => searchCreatorUsers(v, setCreatorPlayerOptions, setSearchingCreatorPlayer)}
              isOptionEqualToValue={(o, v) => o._id === v._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`Buscar usuarios (${creatorSelectedPlayers.length} seleccionados)`}
                  margin="normal"
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setCreatorAddPlayerOpen(false); setCreatorSelectedPlayers([]); setCreatorPlayerOptions([]); }}>
              Cancelar
            </Button>
            <Button variant="contained" disabled={creatorSelectedPlayers.length === 0} onClick={handleCreatorAddPlayer}>
              Agregar ({creatorSelectedPlayers.length})
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={startOpen}
          onClose={() => {
            setStartOpen(false);
            setStartMode(null);
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Iniciar torneo</DialogTitle>
          <DialogContent>
            {!startMode && (
              <Box sx={{ display: 'flex', gap: 2, mt: 1, flexDirection: 'column' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setStartMode('random')}
                >
                  Sortear cuartos automáticamente
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => setStartMode('manual')}
                >
                  Asignar cuartos manualmente
                </Button>
              </Box>
            )}
            {startMode === 'manual' && tournament.teams.length === 8 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Elegí los 2 equipos para cada cuarto. Cada equipo solo puede aparecer
                  una vez.
                </Typography>
                {(['QF1', 'QF2', 'QF3', 'QF4'] as const).map((slot) => (
                  <Box key={slot} sx={{ mb: 2 }}>
                    <Typography fontWeight="bold">{slot}</Typography>
                    {[0, 1].map((idx) => {
                      const usedIds = Object.entries(pairings).flatMap(([s, ids]) =>
                        ids.filter(
                          (_, i) => !(s === slot && i === idx) && Boolean(_)
                        )
                      );
                      const available = tournament.teams.filter(
                        (t) => !usedIds.includes(t.teamId)
                      );
                      return (
                        <FormControl fullWidth size="small" sx={{ my: 0.5 }} key={idx}>
                          <InputLabel>{`Equipo ${idx + 1}`}</InputLabel>
                          <Select
                            label={`Equipo ${idx + 1}`}
                            value={pairings[slot][idx]}
                            onChange={(e) => {
                              const next = { ...pairings };
                              next[slot] = [...pairings[slot]] as [string, string];
                              next[slot][idx] = e.target.value;
                              setPairings(next);
                            }}
                          >
                            {available.map((t) => (
                              <MenuItem key={t.teamId} value={t.teamId}>
                                {t.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            )}
            {startMode === 'manual' &&
              tournament.teams.length !== 8 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  En modo aleatorio de equipos, los equipos se generan recién al iniciar
                  el torneo. Por eso, si querés asignar cuartos manualmente, tu torneo
                  debería ser de equipos armados por jugadores.
                </Alert>
              )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setStartOpen(false);
                setStartMode(null);
              }}
            >
              Cancelar
            </Button>
            {startMode && (
              <Button variant="contained" onClick={handleStart}>
                Confirmar
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default TournamentDetails;
