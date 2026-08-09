import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import TvIcon from '@mui/icons-material/Tv';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { isEmpty } from 'lodash';
import NavBar from '../../components/NavBar';
import SurfaceCard from '../../components/SurfaceCard';
import TournamentLogo from '../../components/TournamentLogo';
import LogoUploader from '../../components/LogoUploader';
import TeamRosterEditor, { RosterTeam, RosterPlayer } from '../../components/TeamRosterEditor';
import useCurrentUser from '../../hooks/useCurrentUser';
import { TournamentLogoMeta, TeamFormationMode, poolBasedMode } from '../../types/tournament';
import { LeagueRef } from '../../types/league';
import API_ROUTES, { apiRequest } from '../../config/api';
import { PHASE_LABELS, PHASE_ORDER, findFocusMatch, isPlayerInMatch, playerKey } from '../../utils/tournament';

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
    signupId?: string;
  }>;
  isDrawn?: boolean;
}

interface Signup {
  signupId: string;
  userId?: string;
  name: string;
  isGuest: boolean;
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
  teamFormationMode: TeamFormationMode;
  guestDrawMode: 'grouped' | 'mixed';
  createdBy: string;
  teams: Team[];
  individualSignups: Signup[];
  draftPairOrder?: string[];
  rosterEditedAt?: string | null;
  matches: string[];
  playerStats: PlayerStat[];
  pointsAwarded: boolean;
  logo?: TournamentLogoMeta | null;
  league?: LeagueRef | null;
}

interface UserOption {
  _id: string;
  username: string;
}

const TEAM_SIZE: Record<Tournament['format'], number> = { duos: 2, trios: 3 };

const TournamentDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useCurrentUser();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const currentUserId = localStorage.getItem('userId') || '';
  const [logoOpen, setLogoOpen] = useState(false);

  // Aviso que puede dejar CreateTournament cuando el torneo se creó bien pero
  // la subida del logo falló.
  const navMessage = (location.state as { message?: string } | null)?.message;
  useEffect(() => {
    if (navMessage) setError(navMessage);
  }, [navMessage]);

  // El aviso de éxito se descarta solo a los pocos segundos; el de error
  // queda hasta que el usuario lo cierra o una nueva acción lo reemplaza.
  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => setInfo(''), 5000);
    return () => clearTimeout(timer);
  }, [info]);

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
  const [creatorGuestNameInput, setCreatorGuestNameInput] = useState('');
  const [creatorGuestNames, setCreatorGuestNames] = useState<string[]>([]);

  const [startOpen, setStartOpen] = useState(false);
  const [startMode, setStartMode] = useState<'random' | 'manual' | null>(null);
  const [pairings, setPairings] = useState<Record<string, [string, string]>>({
    QF1: ['', ''],
    QF2: ['', ''],
    QF3: ['', ''],
    QF4: ['', '']
  });
  const [drawing, setDrawing] = useState(false);

  const [rosterOpen, setRosterOpen] = useState(false);
  const [confirmRedrawOpen, setConfirmRedrawOpen] = useState(false);

  const [expandedPhase, setExpandedPhase] = useState<string | false>(false);
  const [focusMatchId, setFocusMatchId] = useState<string | null>(null);
  const autoExpandedForRef = useRef<string | null>(null);
  const focusMatchRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const tData = await apiRequest(API_ROUTES.TOURNAMENTS.GET(id));
      // Torneos viejos en producción pueden no tener estos campos si se crearon
      // antes de que existieran en el schema (ver scripts/migrateProdToLatest.ts).
      setTournament({ ...tData, teams: tData.teams ?? [], individualSignups: tData.individualSignups ?? [] });
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

  // Auto-abre la fase con el partido relevante (el tuyo si sos jugador, si no
  // la rama más avanzada) una sola vez por torneo, para no pisar la elección
  // manual del usuario en refetchs posteriores (inscripciones, sorteo, etc.).
  useEffect(() => {
    if (loading || !tournament || matches.length === 0) return;
    if (autoExpandedForRef.current === tournament._id) return;
    autoExpandedForRef.current = tournament._id;
    const focus = findFocusMatch(matches, currentUserId);
    if (!focus) return;
    setExpandedPhase(focus.phase);
    if (isPlayerInMatch(focus, currentUserId)) setFocusMatchId(focus._id);
  }, [loading, tournament, matches, currentUserId]);

  // Deja terminar la animación de expansión del Accordion (~300ms) antes de
  // scrollear, si no el destino se calcula sobre una posición que se mueve.
  useEffect(() => {
    if (!focusMatchId || !focusMatchRef.current) return;
    const el = focusMatchRef.current;
    const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    return () => clearTimeout(t);
  }, [focusMatchId]);

  const isCreator = !!tournament && tournament.createdBy === currentUserId;
  const teamSize = tournament ? TEAM_SIZE[tournament.format] : 2;
  const targetIndividuals = tournament ? 8 * TEAM_SIZE[tournament.format] : 16;

  // random y creator-formed: la inscripción es individual y los equipos
  // derivan del pool (`individualSignups`). Espejo de POOL_BASED_FORMATION_MODES
  // en backend/src/config/constants.ts.
  const poolBased = !!tournament && poolBasedMode(tournament.teamFormationMode);

  const userIsRegistered = (() => {
    if (!tournament) return false;
    if (poolBased) {
      return tournament.individualSignups.some((s) => s.userId === currentUserId);
    }
    return tournament.teams.some((t) =>
      t.players.some((p) => p.playerId === currentUserId)
    );
  })();

  // Los equipos "fijos" son los precargados a mano por el creador (addGuestTeam,
  // solo existe en modo random). Los que derivan del pool (isDrawn: sorteados en
  // random, armados a mano en creator-formed) no se suman aparte o los
  // jugadores quedarían contados dos veces.
  // IDs que ya están en el torneo: inscriptos sueltos + jugadores de cualquier equipo.
  // Espeja isUserAlreadyInTournament del backend (tournament.controller.ts).
  const registeredUserIds = new Set<string>(
    tournament
      ? [
          ...tournament.individualSignups.map((s) => s.userId),
          ...tournament.teams.flatMap((t) => t.players.map((p) => p.playerId))
        ].filter((v): v is string => !!v)
      : []
  );

  const fixedTeams = tournament ? tournament.teams.filter((t) => !t.isDrawn) : [];
  const hasDraft = !!tournament?.draftPairOrder && tournament.draftPairOrder.length === 8;

  // Equipos que se pueden reorganizar con el editor: en los modos con pool,
  // solo los que derivan de él (los fijos son inmutables ahí); en user-formed,
  // todos.
  const editableTeams: Team[] = tournament
    ? poolBased
      ? tournament.teams.filter((t) => t.isDrawn)
      : tournament.teams
    : [];

  // Inscriptos del pool que todavía no están en ningún equipo: lo que el
  // editor muestra como "sin asignar".
  const unassignedPool: Signup[] = (() => {
    if (!tournament || !poolBased) return [];
    const assignedKeys = new Set(tournament.teams.flatMap((t) => t.players.map(playerKey)));
    return tournament.individualSignups.filter((s) => !assignedKeys.has(playerKey(s)));
  })();

  // Solo aplica a creator-formed: además de completar el pool, hacen falta
  // los 8 equipos armados y completos para poder iniciar.
  const teamsReady =
    !tournament || tournament.teamFormationMode !== 'creator-formed'
      ? true
      : tournament.teams.length === 8 && tournament.teams.every((t) => t.players.length === teamSize);

  const drawPairings: Array<[Team, Team]> = (() => {
    if (!tournament?.draftPairOrder) return [];
    const order = tournament.draftPairOrder;
    const pairs: Array<[Team, Team]> = [];
    for (let i = 0; i < order.length; i += 2) {
      const a = tournament.teams.find((t) => t.teamId === order[i]);
      const b = tournament.teams.find((t) => t.teamId === order[i + 1]);
      if (a && b) pairs.push([a, b]);
    }
    return pairs;
  })();

  const slotsFilled = (() => {
    if (!tournament) return 0;
    if (poolBased) {
      return tournament.individualSignups.length + fixedTeams.length * teamSize;
    }
    return tournament.teams.length;
  })();

  const totalSlots = tournament ? (poolBased ? targetIndividuals : 8) : 0;

  const cupCompletos = tournament
    ? poolBased
      ? slotsFilled === targetIndividuals && teamsReady
      : tournament.teams.length === 8
    : false;

  // Cupos libres para el modal "Agregar jugador": slotsFilled ya cuenta a los
  // inscriptos actuales, así que lo que se elija en el modal no puede superar esto.
  const remainingSlots = Math.max(0, totalSlots - slotsFilled);
  const creatorAddPlayerCount = creatorSelectedPlayers.length + creatorGuestNames.length;
  const creatorAddPlayerFull = creatorAddPlayerCount >= remainingSlots;

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
      if (poolBasedMode(tournament.teamFormationMode)) {
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
      await apiRequest(API_ROUTES.TOURNAMENTS.REMOVE_TEAM(id, teamId), { method: 'DELETE' });
      setInfo('Equipo eliminado');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al eliminar el equipo');
    }
  };

  const handleCreatorAddPlayer = async () => {
    if (!id) return;
    // El nombre de invitado tipeado pero no confirmado con Enter/"Agregar" no
    // debe perderse si el usuario va directo al botón de guardar del diálogo.
    const pendingGuestName = creatorGuestNameInput.trim();
    const guestNames = pendingGuestName
      ? [...creatorGuestNames, pendingGuestName]
      : creatorGuestNames;
    const dedupedIds = Array.from(
      new Set(creatorSelectedPlayers.map((p) => p._id))
    ).filter((uid) => !registeredUserIds.has(uid));
    if (dedupedIds.length === 0 && guestNames.length === 0) {
      setError('Esos jugadores ya están inscriptos');
      return;
    }
    if (dedupedIds.length + guestNames.length > remainingSlots) {
      setError('No hay cupo suficiente en el torneo para agregar a todos');
      return;
    }
    const userIds = dedupedIds;
    const addedNames = [
      ...creatorSelectedPlayers
        .filter((p) => userIds.includes(p._id))
        .map((p) => p.username),
      ...guestNames
    ];
    setError('');
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.SIGNUP_ADMIN(id), {
        method: 'POST',
        body: JSON.stringify({
          userIds,
          guestNames
        })
      });
      setCreatorAddPlayerOpen(false);
      setCreatorSelectedPlayers([]);
      setCreatorPlayerOptions([]);
      setCreatorGuestNames([]);
      setCreatorGuestNameInput('');
      setInfo(
        addedNames.length === 1
          ? `Se agregó a ${addedNames[0]}`
          : `Se agregaron ${addedNames.length} jugadores: ${addedNames.join(', ')}`
      );
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al inscribir el jugador');
    }
  };

  const handleAddCreatorGuestName = () => {
    const name = creatorGuestNameInput.trim();
    if (!name || creatorAddPlayerFull) return;
    setCreatorGuestNames([...creatorGuestNames, name]);
    setCreatorGuestNameInput('');
  };

  const handleRemoveCreatorGuestName = (index: number) => {
    setCreatorGuestNames(creatorGuestNames.filter((_, i) => i !== index));
  };

  const handleDraw = async () => {
    if (!id) return;
    setError('');
    setDrawing(true);
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.DRAW(id), { method: 'POST' });
      setInfo('Sorteo realizado');
      await fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al sortear el torneo');
    } finally {
      setDrawing(false);
    }
  };

  // En random, re-sortear rearma los equipos desde cero: si el creador ya
  // editó la plantilla a mano, se pierde. En los demás modos "sortear" solo
  // baraja los cruces y no toca los equipos, así que no hace falta avisar.
  const handleDrawClick = () => {
    if (tournament?.teamFormationMode === 'random' && tournament.rosterEditedAt) {
      setConfirmRedrawOpen(true);
      return;
    }
    handleDraw();
  };

  const handleConfirmRedraw = () => {
    setConfirmRedrawOpen(false);
    handleDraw();
  };

  const handleCreatorRemovePlayer = async (signupId: string) => {
    if (!id) return;
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.SIGNUP_ADMIN_REMOVE(id, signupId), { method: 'DELETE' });
      setInfo('Jugador quitado');
      fetchData();
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Error al quitar el jugador');
    }
  };

  const handleConfirmDraftStart = async () => {
    if (!id) return;
    setError('');
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.START(id), {
        method: 'POST',
        body: JSON.stringify({ mode: 'random' })
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

  const isUserInMatch = (m: Match) => isPlayerInMatch(m, currentUserId);

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
    const isFocus = match._id === focusMatchId;

    return (
      <Grid item xs={12} key={match._id} ref={isFocus ? focusMatchRef : undefined}>
        <Paper
          sx={{
            p: 2,
            ...(isFocus && {
              border: '2px solid #fbc02d',
              boxShadow: '0 0 0 4px rgba(251,192,45,0.15)'
            })
          }}
        >
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
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {isFocus && (
                <Chip
                  label="Tu partido"
                  size="small"
                  sx={{ backgroundColor: '#fbc02d', color: '#000', fontWeight: 'bold' }}
                />
              )}
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

  const rosterTeams: RosterTeam[] = editableTeams.map((t) => ({
    teamId: t.teamId,
    name: t.name,
    registeredBy: t.registeredBy,
    players: t.players.map((p) => ({
      signupId: p.signupId,
      playerId: p.playerId,
      name: p.name,
      isGuest: p.isGuest
    }))
  }));

  const rosterUnassigned: RosterPlayer[] = unassignedPool.map((s) => ({
    signupId: s.signupId,
    playerId: s.userId,
    name: s.name,
    isGuest: s.isGuest
  }));

  const handleRosterSaved = (message: string) => {
    setInfo(message);
    fetchData();
  };

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <SurfaceCard>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
              <TournamentLogo tournament={tournament} size={64} />
              <Typography variant="h4" gutterBottom sx={{ mb: 0, color: '#FFD700', fontWeight: 700 }}>
                {tournament.name}
              </Typography>
            </Box>
            {tournament.status !== 'upcoming' && (
              <Button
                variant="contained"
                startIcon={<TvIcon />}
                onClick={() => window.open(`/live/${tournament._id}`, '_blank', 'noopener')}
                sx={{
                  bgcolor: '#D4AF37',
                  color: '#000',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#c29d2e' }
                }}
              >
                Transmitir
              </Button>
            )}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo('')}>{info}</Alert>}

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
              {tournament.league && (
                <Chip
                  size="small"
                  label={`Liga: ${tournament.league.name}`}
                  color="secondary"
                  onClick={() => navigate(`/leagues/${tournament.league!._id}`)}
                />
              )}
            </Box>

            {/* El logo es cosmético, así que se puede cambiar en cualquier
                estado del torneo, no solo mientras está en 'upcoming'. */}
            {(isCreator || isAdmin) && (
              <Button
                size="small"
                startIcon={<PhotoCameraIcon />}
                onClick={() => setLogoOpen(true)}
                sx={{ mt: 1.5 }}
              >
                {tournament.logo ? 'Cambiar logo' : 'Agregar logo'}
              </Button>
            )}
          </Box>

          {tournament.status === 'upcoming' && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Inscripciones
              </Typography>

              {poolBased ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Inscriptos ({slotsFilled}/{totalSlots}):
                  </Typography>
                  {tournament.individualSignups.length === 0 && fixedTeams.length === 0 ? (
                    <Typography variant="body2">Aún no hay inscriptos.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {tournament.individualSignups.map((s) => (
                        <Chip
                          key={s.signupId}
                          size="small"
                          variant={s.isGuest ? 'outlined' : 'filled'}
                          label={s.isGuest ? `${s.name} (invitado)` : s.name}
                          onDelete={isCreator ? () => handleCreatorRemovePlayer(s.signupId) : undefined}
                        />
                      ))}
                      {fixedTeams.map((t) =>
                        t.players.map((p, i) => (
                          <Chip
                            key={p.playerId || `${t.teamId}-${i}`}
                            size="small"
                            variant={p.isGuest ? 'outlined' : 'filled'}
                            label={p.isGuest ? `${p.name} (invitado)` : p.name}
                          />
                        ))
                      )}
                    </Box>
                  )}
                  {tournament.teamFormationMode === 'creator-formed' && editableTeams.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Equipos armados ({editableTeams.length}/8):
                      </Typography>
                      {editableTeams.map((t) => (
                        <Paper key={t.teamId} variant="outlined" sx={{ p: 1, my: 1 }}>
                          <Typography variant="subtitle2">{t.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t.players.map((p) => p.name).join(', ') || 'Sin jugadores'}
                          </Typography>
                        </Paper>
                      ))}
                      {unassignedPool.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Sin asignar: {unassignedPool.length} jugador(es)
                        </Typography>
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
                {isCreator && slotsFilled < totalSlots && poolBased && (
                  <Button variant="outlined" onClick={() => setCreatorAddPlayerOpen(true)}>
                    Agregar jugador
                  </Button>
                )}
                {isCreator && slotsFilled < totalSlots && tournament.teamFormationMode === 'user-formed' && (
                  <Button variant="outlined" onClick={() => setGuestOpen(true)}>
                    Agregar invitados
                  </Button>
                )}
                {isCreator && tournament.teamFormationMode === 'creator-formed' && (
                  <Button variant="outlined" onClick={() => setRosterOpen(true)}>
                    {tournament.teams.length > 0 ? 'Editar equipos' : 'Armar equipos'}
                  </Button>
                )}
                {isCreator && tournament.teamFormationMode === 'user-formed' && tournament.teams.length >= 2 && (
                  <Button variant="outlined" onClick={() => setRosterOpen(true)}>
                    Reorganizar jugadores
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

          {tournament.status === 'upcoming' && isCreator && cupCompletos && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Sorteo
              </Typography>
              {tournament.teamFormationMode === 'random' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Invitados: {tournament.guestDrawMode === 'mixed'
                    ? 'mezclados con todos los jugadores'
                    : 'agrupados entre ellos'}
                </Typography>
              )}
              {!hasDraft ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {tournament.teamFormationMode === 'random'
                      ? 'Sorteá los equipos y los cruces de cuartos. Vas a poder ver el resultado y volver a sortear las veces que quieras antes de iniciar el torneo.'
                      : 'Sorteá los cruces de cuartos entre los 8 equipos armados.'}
                  </Typography>
                  <Button variant="contained" disabled={drawing} onClick={handleDrawClick}>
                    {drawing
                      ? 'Sorteando...'
                      : tournament.teamFormationMode === 'random'
                      ? 'Sortear equipos y cruces'
                      : 'Sortear cruces de cuartos'}
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Equipos:
                    </Typography>
                    {tournament.teamFormationMode === 'random' && tournament.rosterEditedAt && (
                      <Chip size="small" color="warning" label="Editado a mano" />
                    )}
                  </Box>
                  {tournament.teams.map((t) => (
                    <Paper key={t.teamId} variant="outlined" sx={{ p: 1, my: 1 }}>
                      <Typography variant="subtitle2">
                        {t.name}
                        {t.isDrawn ? '' : ' (fijo)'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.players
                          .map((p) => (p.isGuest ? `${p.name} (invitado)` : p.name))
                          .join(', ')}
                      </Typography>
                    </Paper>
                  ))}

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                    Cruces de cuartos:
                  </Typography>
                  {drawPairings.map(([a, b], i) => (
                    <Typography key={a.teamId} variant="body2" sx={{ mb: 0.5 }}>
                      QF{i + 1}: {a.name} vs {b.name}
                    </Typography>
                  ))}

                  <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                    <Button variant="outlined" disabled={drawing} onClick={handleDrawClick}>
                      {drawing ? 'Sorteando...' : 'Re-sortear'}
                    </Button>
                    {tournament.teamFormationMode === 'random' && (
                      <Button variant="outlined" onClick={() => setRosterOpen(true)}>
                        Editar equipos
                      </Button>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Usá el botón "Iniciar torneo" de arriba cuando estés conforme con el sorteo.
                  </Typography>
                </Box>
              )}
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
                    <Accordion
                      expanded={expandedPhase === phase}
                      onChange={(_, isExpanded) => setExpandedPhase(isExpanded ? phase : false)}
                    >
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
        </SurfaceCard>

        <Dialog
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Inscribirme al torneo</DialogTitle>
          <DialogContent>
            {poolBased ? (
              <Typography>
                {tournament.teamFormationMode === 'random'
                  ? 'Te vas a inscribir individualmente. El sistema sortea los equipos al iniciar el torneo.'
                  : 'Te vas a inscribir individualmente. El creador arma los equipos a mano cuando se completa el cupo.'}
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
          onClose={() => {
            setCreatorAddPlayerOpen(false);
            setCreatorSelectedPlayers([]);
            setCreatorPlayerOptions([]);
            setCreatorGuestNames([]);
            setCreatorGuestNameInput('');
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Agregar jugadores al torneo</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
              Podés seleccionar varios jugadores registrados y agregar invitados sueltos.
              {tournament?.teamFormationMode === 'creator-formed'
                ? ' Cuando se complete el cupo, vas a poder armar los equipos a mano.'
                : tournament?.guestDrawMode === 'mixed'
                ? ' Al sortear, los invitados entran al pool general y se mezclan con los jugadores registrados.'
                : ' Al sortear, los invitados se agrupan entre ellos antes de completar equipos con jugadores registrados.'}
            </Typography>
            <Typography
              variant="body2"
              color={creatorAddPlayerFull ? 'error' : 'text.secondary'}
              sx={{ mb: 1 }}
            >
              {creatorAddPlayerFull
                ? 'Llegaste al cupo del torneo: no podés agregar más jugadores ni invitados.'
                : `Cupos disponibles: ${remainingSlots - creatorAddPlayerCount} de ${remainingSlots}`}
            </Typography>
            <Autocomplete
              multiple
              options={creatorPlayerOptions}
              loading={searchingCreatorPlayer}
              getOptionLabel={(o) => o.username}
              value={creatorSelectedPlayers}
              onChange={(_, v) => {
                if (v.length + creatorGuestNames.length <= remainingSlots) setCreatorSelectedPlayers(v);
              }}
              onInputChange={(_, v) => searchCreatorUsers(v, setCreatorPlayerOptions, setSearchingCreatorPlayer)}
              isOptionEqualToValue={(o, v) => o._id === v._id}
              filterOptions={(opts) =>
                creatorAddPlayerFull
                  ? []
                  : opts.filter(
                      (o) =>
                        !registeredUserIds.has(o._id) &&
                        !creatorSelectedPlayers.some((p) => p._id === o._id)
                    )
              }
              noOptionsText={
                creatorAddPlayerFull
                  ? 'Cupo completo'
                  : 'Sin resultados nuevos (los ya inscriptos y los seleccionados no se muestran)'
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`Buscar usuarios (${creatorSelectedPlayers.length} seleccionados)`}
                  margin="normal"
                />
              )}
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                size="small"
                label="Nombre del invitado"
                value={creatorGuestNameInput}
                onChange={(e) => setCreatorGuestNameInput(e.target.value)}
                disabled={creatorAddPlayerFull}
                color={creatorGuestNameInput.trim() ? 'warning' : undefined}
                focused={!!creatorGuestNameInput.trim()}
                helperText={
                  creatorGuestNameInput.trim()
                    ? 'Presioná Enter o "Agregar" para sumarlo a la lista'
                    : ' '
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCreatorGuestName();
                  }
                }}
              />
              <Button variant="outlined" onClick={handleAddCreatorGuestName} disabled={creatorAddPlayerFull}>
                Agregar
              </Button>
            </Box>
            {creatorGuestNames.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {creatorGuestNames.map((name, i) => (
                  <Chip
                    key={`${name}-${i}`}
                    size="small"
                    variant="outlined"
                    label={`${name} (invitado)`}
                    onDelete={() => handleRemoveCreatorGuestName(i)}
                  />
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCreatorAddPlayerOpen(false);
                setCreatorSelectedPlayers([]);
                setCreatorPlayerOptions([]);
                setCreatorGuestNames([]);
                setCreatorGuestNameInput('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              disabled={
                creatorSelectedPlayers.length === 0 &&
                creatorGuestNames.length === 0 &&
                !creatorGuestNameInput.trim()
              }
              onClick={handleCreatorAddPlayer}
            >
              Agregar ({creatorSelectedPlayers.length + creatorGuestNames.length + (creatorGuestNameInput.trim() ? 1 : 0)})
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
            {!startMode && hasDraft && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Ya sorteaste equipos y cruces. Revisá el resumen y confirmá para iniciar
                  el torneo.
                </Typography>
                {tournament.teams.map((t) => (
                  <Typography key={t.teamId} variant="body2" color="text.secondary">
                    {t.name}: {t.players.map((p) => p.name).join(', ')}
                  </Typography>
                ))}
                <Typography variant="body2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                  Cruces de cuartos:
                </Typography>
                {drawPairings.map(([a, b], i) => (
                  <Typography key={a.teamId} variant="body2">
                    QF{i + 1}: {a.name} vs {b.name}
                  </Typography>
                ))}
                <Button sx={{ mt: 2 }} size="small" onClick={() => setStartMode('manual')}>
                  Elegir cuartos manualmente en su lugar
                </Button>
              </Box>
            )}
            {!startMode && !hasDraft && (
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
            {!startMode && hasDraft && (
              <Button variant="contained" onClick={handleConfirmDraftStart}>
                Confirmar
              </Button>
            )}
            {startMode && (
              <Button variant="contained" onClick={handleStart}>
                Confirmar
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <Dialog open={logoOpen} onClose={() => setLogoOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Logo del torneo</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <LogoUploader
                uploadUrl={API_ROUTES.TOURNAMENTS.LOGO_UPLOAD(tournament._id)}
                deleteUrl={API_ROUTES.TOURNAMENTS.LOGO_DELETE(tournament._id)}
                currentLogoUrl={
                  tournament.logo?.version
                    ? API_ROUTES.TOURNAMENTS.LOGO(tournament._id, tournament.logo.version)
                    : undefined
                }
                label=""
                onUploaded={(logo) =>
                  setTournament((prev) => (prev ? { ...prev, logo } : prev))
                }
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLogoOpen(false)}>Listo</Button>
          </DialogActions>
        </Dialog>

        <TeamRosterEditor
          open={rosterOpen}
          onClose={() => setRosterOpen(false)}
          tournamentId={tournament._id}
          mode={tournament.teamFormationMode}
          teamSize={teamSize}
          teams={rosterTeams}
          unassigned={rosterUnassigned}
          hasDraft={hasDraft}
          onSaved={handleRosterSaved}
        />

        <Dialog open={confirmRedrawOpen} onClose={() => setConfirmRedrawOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Re-sortear los equipos</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Los equipos se van a rearmar desde cero con los inscriptos. Los cambios que hiciste
              a mano se van a perder. Los cruces de cuartos también se vuelven a sortear.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmRedrawOpen(false)}>Cancelar</Button>
            <Button color="warning" variant="contained" onClick={handleConfirmRedraw}>
              Re-sortear igual
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default TournamentDetails;
