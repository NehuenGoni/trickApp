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
import EditNoteIcon from '@mui/icons-material/EditNote';
import NavBar from '../../components/NavBar';
import SurfaceCard from '../../components/SurfaceCard';
import TournamentLogo from '../../components/TournamentLogo';
import LogoUploader from '../../components/LogoUploader';
import TeamRosterEditor, { RosterTeam, RosterPlayer } from '../../components/TeamRosterEditor';
import BracketFormatPreview from '../../components/BracketFormatPreview';
import PlanLimitAlert from '../../components/PlanLimitAlert';
import useCurrentUser from '../../hooks/useCurrentUser';
import useBilling, { clearBillingCache } from '../../hooks/useBilling';
import useManageableLeagues from '../../hooks/useManageableLeagues';
import { TournamentLogoMeta, TeamFormationMode, poolBasedMode } from '../../types/tournament';
import { LeagueRef } from '../../types/league';
import API_ROUTES, { apiRequest, PaymentRequiredError } from '../../config/api';
import { canManageTournament } from '../../utils/tournamentPermissions';
import {
  PHASE_LABELS,
  findFocusMatch,
  isPlayerInMatch,
  playerKey,
  firstRoundSlotsFor,
  restingCountFor,
  splitDraftOrder,
  zoneOfSlot,
  downstreamBlockers
} from '../../utils/tournament';
import MatchResultDialog from '../../components/MatchResultDialog';

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
  feedsWinnerTo?: string;
  feedsLoserTo?: string;
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
  numberOfTeams: number;
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
  const { user, isAdmin } = useCurrentUser();
  const { leagueIds: manageableLeagueIds } = useManageableLeagues();
  const { billing } = useBilling();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // Cupo de liga alcanzado (402, `league_member_limit_reached`): se muestra
  // aparte del error genérico porque necesita el CTA condicional a "Ver
  // planes" (`canUpgrade`), que un string suelto no puede cargar.
  const [planLimitError, setPlanLimitError] = useState<{ message: string; canUpgrade: boolean } | null>(null);
  // Partido que el organizador está anotando/corrigiendo a mano (ver
  // `renderMatchCard` y el `<MatchResultDialog>` al final del componente).
  const [resultTarget, setResultTarget] = useState<Match | null>(null);
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
  const [registerGuests, setRegisterGuests] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamMembers, setEditTeamMembers] = useState<UserOption[]>([]);
  const [editTeamGuests, setEditTeamGuests] = useState<string[]>([]);

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
  // Cupo de LIGA disponible (distinto del cupo del torneo): solo tiene
  // sentido mostrarlo cuando el que mira es el dueño del plan — es su cupo,
  // no el de un organizador cualquiera. Se pide al abrir el diálogo, no en
  // cada tecla.
  const [leagueCapHint, setLeagueCapHint] = useState<{ current: number; limit: number } | null>(null);

  const [startOpen, setStartOpen] = useState(false);
  const [startMode, setStartMode] = useState<'random' | 'manual' | null>(null);
  // Se inicializan recién al abrir el diálogo (`openStartDialog`), porque la
  // cantidad de cruces/descansos depende de `tournament.numberOfTeams`, que
  // todavía no se conoce en el primer render.
  const [pairings, setPairings] = useState<Record<string, [string, string]>>({});
  const [restingIds, setRestingIds] = useState<string[]>([]);
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

  // Cupo de la liga (distinto del cupo del torneo, que ya se muestra arriba):
  // se pide al abrir el diálogo de alta, y solo si tiene sentido — torneo
  // ligado a una liga, plan con tope y el que mira es el dueño de esa liga
  // (mismo criterio que el bloque de plan de LeagueDetails).
  useEffect(() => {
    if (!creatorAddPlayerOpen || !tournament?.league || billing?.limits.maxMembers == null) {
      setLeagueCapHint(null);
      return;
    }
    let active = true;
    apiRequest(API_ROUTES.LEAGUES.DETAIL(tournament.league._id))
      .then((data) => {
        if (!active) return;
        if (data?.league?.createdBy !== user?._id) return; // no es el dueño: no le corresponde ver esto
        setLeagueCapHint({ current: data.playerCounts.playerCount, limit: billing.limits.maxMembers as number });
      })
      .catch(() => {
        /* hint puramente informativo: si falla, simplemente no se muestra */
      });
    return () => {
      active = false;
    };
  }, [creatorAddPlayerOpen, tournament?.league, billing, user?._id]);

  const canManage = !!tournament && canManageTournament(user, tournament, manageableLeagueIds);
  const teamSize = tournament ? TEAM_SIZE[tournament.format] : 2;
  const numberOfTeams = tournament?.numberOfTeams ?? 8; // torneos legacy: el tamaño de siempre.
  const targetIndividuals = tournament ? numberOfTeams * TEAM_SIZE[tournament.format] : 16;

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
  const hasDraft = !!tournament?.draftPairOrder && tournament.draftPairOrder.length === numberOfTeams;

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
  // los `numberOfTeams` equipos armados y completos para poder iniciar.
  const teamsReady =
    !tournament || tournament.teamFormationMode !== 'creator-formed'
      ? true
      : tournament.teams.length === numberOfTeams &&
        tournament.teams.every((t) => t.players.length === teamSize);

  // Cruces de la 1ra ronda + quiénes descansan (solo si numberOfTeams no es
  // potencia de 2 — ver splitDraftOrder). Nadie descansa dos veces: los que
  // quedan afuera de los cruces de arriba entran directo a la zona de oro.
  const { pairs: drawPairings, resting: drawResting }: { pairs: Array<[Team, Team]>; resting: Team[] } = (() => {
    if (!tournament?.draftPairOrder) return { pairs: [], resting: [] };
    const findTeam = (tid: string) => tournament.teams.find((t) => t.teamId === tid);
    const { pairs, resting } = splitDraftOrder(tournament.draftPairOrder, numberOfTeams);
    const resolvedPairs = pairs.flatMap(([aId, bId]): Array<[Team, Team]> => {
      const a = findTeam(aId);
      const b = findTeam(bId);
      return a && b ? [[a, b]] : [];
    });
    const resolvedResting = resting.flatMap((tid) => {
      const t = findTeam(tid);
      return t ? [t] : [];
    });
    return { pairs: resolvedPairs, resting: resolvedResting };
  })();

  const slotsFilled = (() => {
    if (!tournament) return 0;
    if (poolBased) {
      return tournament.individualSignups.length + fixedTeams.length * teamSize;
    }
    return tournament.teams.length;
  })();

  const totalSlots = tournament ? (poolBased ? targetIndividuals : numberOfTeams) : 0;

  const cupCompletos = tournament
    ? poolBased
      ? slotsFilled === targetIndividuals && teamsReady
      : tournament.teams.length === numberOfTeams
    : false;

  // Cupos libres para el modal "Agregar jugador": slotsFilled ya cuenta a los
  // inscriptos actuales, así que lo que se elija en el modal no puede superar esto.
  const remainingSlots = Math.max(0, totalSlots - slotsFilled);
  const creatorAddPlayerCount = creatorSelectedPlayers.length + creatorGuestNames.length;
  const creatorAddPlayerFull = creatorAddPlayerCount >= remainingSlots;

  /**
   * Catch compartido por los 4 handlers que agregan gente al torneo: si el
   * 402 es por cupo de liga, se muestra con `PlanLimitAlert` (necesita el
   * `canUpgrade` que trae el backend); cualquier otro error sigue el camino
   * genérico de siempre.
   */
  const handleAddPlayersError = (err: unknown, fallbackMessage: string) => {
    if (err instanceof PaymentRequiredError && err.reason === 'league_member_limit_reached') {
      clearBillingCache(); // el uso cambió (o el organizador quiere ver el estado real en "Mi Plan")
      setPlanLimitError({ message: err.message, canUpgrade: !!err.canUpgrade });
      return;
    }
    const e = err as { message?: string };
    setError(e.message || fallbackMessage);
  };

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
    setPlanLimitError(null);
    try {
      if (poolBasedMode(tournament.teamFormationMode)) {
        await apiRequest(API_ROUTES.TOURNAMENTS.REGISTER(id), { method: 'POST' });
      } else {
        if (!registerTeamName.trim()) {
          setError('Ingresá el nombre del equipo');
          return;
        }
        const guestList = registerGuests.filter((g) => g.trim());
        const members = [
          { playerId: currentUserId, isGuest: false },
          ...registerMembers.map((m) => ({ playerId: m._id, name: m.username, isGuest: false })),
          ...guestList.map((g) => ({ name: g, isGuest: true }))
        ];
        if (members.length !== teamSize) {
          setError(`Faltan integrantes: ${members.length}/${teamSize}`);
          return;
        }
        await apiRequest(API_ROUTES.TOURNAMENTS.REGISTER(id), {
          method: 'POST',
          body: JSON.stringify({
            teamName: registerTeamName,
            members
          })
        });
      }
      setRegisterOpen(false);
      setRegisterTeamName('');
      setRegisterMembers([]);
      setRegisterGuests([]);
      setInfo('Inscripción registrada');
      fetchData();
    } catch (err) {
      handleAddPlayersError(err, 'Error en la inscripción');
    }
  };

  const openEditTeam = (t: Team) => {
    const others = t.players.filter((p) => p.playerId !== currentUserId);
    setEditTeamId(t.teamId);
    setEditTeamName(t.name);
    setEditTeamMembers(
      others
        .filter((p) => !p.isGuest && p.playerId)
        .map((p) => ({ _id: p.playerId as string, username: p.name }))
    );
    setEditTeamGuests(others.filter((p) => p.isGuest).map((p) => p.name));
    setEditTeamOpen(true);
  };

  const handleEditTeam = async () => {
    if (!id) return;
    setError('');
    setPlanLimitError(null);
    if (!editTeamName.trim()) {
      setError('Ingresá el nombre del equipo');
      return;
    }
    const guestList = editTeamGuests.filter((g) => g.trim());
    const members = [
      { playerId: currentUserId, isGuest: false },
      ...editTeamMembers.map((m) => ({ playerId: m._id, name: m.username, isGuest: false })),
      ...guestList.map((g) => ({ name: g, isGuest: true }))
    ];
    if (members.length !== teamSize) {
      setError(`Faltan integrantes: ${members.length}/${teamSize}`);
      return;
    }
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.UPDATE_TEAM(id, editTeamId), {
        method: 'PUT',
        body: JSON.stringify({ teamName: editTeamName, members })
      });
      setEditTeamOpen(false);
      setEditTeamMembers([]);
      setEditTeamGuests([]);
      setInfo('Equipo actualizado');
      fetchData();
    } catch (err) {
      handleAddPlayersError(err, 'Error al editar el equipo');
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
    setPlanLimitError(null);
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
      handleAddPlayersError(err, 'Error al agregar equipo de invitados');
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
    setPlanLimitError(null);
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
      handleAddPlayersError(err, 'Error al agregar el equipo');
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
    setPlanLimitError(null);
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
      handleAddPlayersError(err, 'Error al inscribir el jugador');
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

  // Arma el estado inicial del diálogo de inicio manual: tantos cruces vacíos
  // como necesite `numberOfTeams`, más un slot de "descansa" por cada equipo
  // que el cuadro no alcanza a emparejar en la 1ra ronda (0 si es potencia de 2).
  const openStartDialog = () => {
    if (tournament) {
      const slots = firstRoundSlotsFor(tournament.numberOfTeams);
      setPairings(Object.fromEntries(slots.map((s) => [s, ['', ''] as [string, string]])));
      setRestingIds(Array(restingCountFor(tournament.numberOfTeams)).fill(''));
    }
    setStartOpen(true);
  };

  const handleStart = async () => {
    if (!id || !tournament || !startMode) return;
    try {
      const body: {
        mode: string;
        pairings?: Array<{ slot: string; teamIds: string[] }>;
        resting?: string[];
      } = { mode: startMode };
      if (startMode === 'manual') {
        const slots = firstRoundSlotsFor(tournament.numberOfTeams);
        const arr = slots.map((s) => ({ slot: s, teamIds: pairings[s] ?? ['', ''] }));
        if (arr.some((e) => !e.teamIds[0] || !e.teamIds[1])) {
          setError('Completá todos los cruces de la primera ronda');
          return;
        }
        const restCount = restingCountFor(tournament.numberOfTeams);
        if (restCount > 0) {
          if (restingIds.length !== restCount || restingIds.some((r) => !r)) {
            setError('Indicá qué equipos descansan la primera ronda');
            return;
          }
          body.resting = restingIds;
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

          {(userInMatch && match.status === 'in_progress') || (canManage && match.teams.length === 2) ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {userInMatch && match.status === 'in_progress' && (
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
              )}
              {canManage && match.teams.length === 2 && (
                <Button
                  variant="outlined"
                  startIcon={<EditNoteIcon />}
                  onClick={() => setResultTarget(match)}
                >
                  {match.status === 'finished' ? 'Corregir' : 'Anotar'}
                </Button>
              )}
            </Box>
          ) : null}
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

  const handleMatchResultSaved = (message: string) => {
    setInfo(message);
    setResultTarget(null);
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
            {tournament.status === 'upcoming' && canManage && (
              <Button
                variant="contained"
                color="success"
                disabled={!cupCompletos}
                onClick={openStartDialog}
              >
                Iniciar torneo
              </Button>
            )}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {planLimitError && (
            <PlanLimitAlert
              sx={{ mb: 2 }}
              severity="error"
              message={planLimitError.message}
              canUpgrade={planLimitError.canUpgrade}
            />
          )}
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
            {(canManage || isAdmin) && (
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
            <Accordion sx={{ mb: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Cómo va a ser el torneo</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <BracketFormatPreview
                  numberOfTeams={numberOfTeams}
                  firstRoundPairings={hasDraft ? drawPairings : undefined}
                  restingTeams={hasDraft ? drawResting : undefined}
                />
              </AccordionDetails>
            </Accordion>
          )}

          {tournament.status === 'upcoming' && (
            <Accordion defaultExpanded sx={{ mb: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Inscripciones</Typography>
              </AccordionSummary>
              <AccordionDetails>

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
                          onDelete={canManage ? () => handleCreatorRemovePlayer(s.signupId) : undefined}
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
                        Equipos armados ({editableTeams.length}/{numberOfTeams}):
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
                    Equipos ({tournament.teams.length}/{numberOfTeams}):
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
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {t.registeredBy === currentUserId && (
                            <Button size="small" onClick={() => openEditTeam(t)}>
                              Editar
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleCreatorRemoveTeam(t.teamId)}
                            >
                              Quitar
                            </Button>
                          )}
                        </Box>
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
                {canManage && slotsFilled < totalSlots && tournament.teamFormationMode === 'user-formed' && (
                  <Button variant="outlined" onClick={() => setCreatorAddTeamOpen(true)}>
                    Agregar equipo
                  </Button>
                )}
                {canManage && slotsFilled < totalSlots && poolBased && (
                  <Button variant="outlined" onClick={() => setCreatorAddPlayerOpen(true)}>
                    Agregar jugador
                  </Button>
                )}
                {canManage && slotsFilled < totalSlots && tournament.teamFormationMode === 'user-formed' && (
                  <Button variant="outlined" onClick={() => setGuestOpen(true)}>
                    Agregar invitados
                  </Button>
                )}
                {canManage && tournament.teamFormationMode === 'creator-formed' && (
                  <Button variant="outlined" onClick={() => setRosterOpen(true)}>
                    {tournament.teams.length > 0 ? 'Editar equipos' : 'Armar equipos'}
                  </Button>
                )}
                {canManage && tournament.teamFormationMode === 'user-formed' && tournament.teams.length >= 2 && (
                  <Button variant="outlined" onClick={() => setRosterOpen(true)}>
                    Reorganizar jugadores
                  </Button>
                )}
              </Box>
              </AccordionDetails>
            </Accordion>
          )}

          {tournament.status === 'upcoming' && canManage && cupCompletos && (
            <Accordion sx={{ mb: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Sorteo</Typography>
              </AccordionSummary>
              <AccordionDetails>
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
                      ? 'Sorteá los equipos y los cruces de la primera ronda. Vas a poder ver el resultado y volver a sortear las veces que quieras antes de iniciar el torneo.'
                      : `Sorteá los cruces de la primera ronda entre los ${numberOfTeams} equipos armados.`}
                  </Typography>
                  <Button variant="contained" disabled={drawing} onClick={handleDrawClick}>
                    {drawing
                      ? 'Sorteando...'
                      : tournament.teamFormationMode === 'random'
                      ? 'Sortear equipos y cruces'
                      : 'Sortear cruces de la primera ronda'}
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
                    Cruces de la primera ronda:
                  </Typography>
                  {drawPairings.map(([a, b], i) => (
                    <Typography key={a.teamId} variant="body2" sx={{ mb: 0.5 }}>
                      Cruce {i + 1}: {a.name} vs {b.name}
                    </Typography>
                  ))}
                  {drawResting.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Descansan la primera ronda: {drawResting.map((t) => t.name).join(', ')}
                    </Typography>
                  )}

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
              </AccordionDetails>
            </Accordion>
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

          {matches.length > 0 && (() => {
            // Agrupa por `phase` tal cual lo manda el backend: para el cuadro
            // de 8 de siempre son las claves legacy ('quarter-finals', etc,
            // traducidas acá con PHASE_LABELS); para cualquier otro tamaño ya
            // vienen en español (`phaseLabelFor` en backend/src/utils/bracket.ts),
            // así que se muestran tal cual. Antes esto filtraba contra una
            // lista fija de 7 fases legacy y por eso ningún torneo con una
            // cantidad de equipos distinta de 8 mostraba sus partidos acá.
            const groups = new Map<string, Match[]>();
            for (const m of matches) {
              const key = m.phase || 'Otros partidos';
              const bucket = groups.get(key);
              if (bucket) bucket.push(m);
              else groups.set(key, [m]);
            }
            // Orden de arriba hacia abajo: zona más grande (ronda más
            // temprana) primero y, dentro del mismo tamaño, oro antes que
            // plata — mismo criterio que `buildBracketRows` en utils/tournament.ts.
            // Para el cuadro de 8 de siempre se respeta el orden legacy tal
            // cual estaba (difiere en un detalle del criterio genérico: ahí
            // "Match por 3°/4°" quedaba después de "Final de Plata").
            const LEGACY_PHASE_ORDER = [
              'quarter-finals', 'semifinals-gold', 'semifinals',
              'final-gold', 'final', 'third-place', 'seventh-place'
            ];
            const orderedPhases = Array.from(groups.keys()).sort((a, b) => {
              const la = LEGACY_PHASE_ORDER.indexOf(a);
              const lb = LEGACY_PHASE_ORDER.indexOf(b);
              if (la !== -1 && lb !== -1) return la - lb;
              const za = zoneOfSlot(groups.get(a)![0].bracketSlot || '');
              const zb = zoneOfSlot(groups.get(b)![0].bracketSlot || '');
              const sizeA = za ? za.posHigh - za.posLow + 1 : 0;
              const sizeB = zb ? zb.posHigh - zb.posLow + 1 : 0;
              if (sizeA !== sizeB) return sizeB - sizeA;
              return (za?.posLow ?? 0) - (zb?.posLow ?? 0);
            });

            return (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Partidos del torneo
                </Typography>

                {orderedPhases.map((phase) => {
                  const phaseMatches = groups.get(phase)!;
                  const label = PHASE_LABELS[phase] ?? phase;
                  return (
                    <Box sx={{ mb: 2 }} key={phase}>
                      <Accordion
                        expanded={expandedPhase === phase}
                        onChange={(_, isExpanded) => setExpandedPhase(isExpanded ? phase : false)}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography fontWeight="bold">{label}</Typography>
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
            );
          })()}
        </SurfaceCard>

        <Dialog
          open={registerOpen}
          onClose={() => { setRegisterOpen(false); setRegisterGuests([]); }}
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
                  Vos ya estás incluido. Completá los otros {teamSize - 1}{' '}
                  {teamSize === 2 ? 'lugar' : 'lugares'} con compañeros registrados o invitados sin cuenta.
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
                      label={`Compañeros registrados (${registerMembers.length}/${teamSize - 1})`}
                      margin="normal"
                      helperText="Podés completar el resto del equipo con invitados sin cuenta"
                    />
                  )}
                />
                {Array.from({ length: Math.max(0, teamSize - 1 - registerMembers.length) }).map((_, i) => (
                  <TextField
                    key={i}
                    fullWidth
                    label={`Invitado ${i + 1} (nombre)`}
                    value={registerGuests[i] || ''}
                    onChange={(e) => {
                      const arr = [...registerGuests];
                      arr[i] = e.target.value;
                      setRegisterGuests(arr);
                    }}
                    margin="dense"
                  />
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setRegisterOpen(false); setRegisterGuests([]); }}>Cancelar</Button>
            <Button variant="contained" onClick={handleRegister}>
              Inscribirme
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={editTeamOpen}
          onClose={() => { setEditTeamOpen(false); setEditTeamMembers([]); setEditTeamGuests([]); }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Editar equipo</DialogTitle>
          <DialogContent>
            <Box>
              <TextField
                fullWidth
                label="Nombre del equipo"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                margin="normal"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Vos ya estás incluido. Completá los otros {teamSize - 1}{' '}
                {teamSize === 2 ? 'lugar' : 'lugares'} con compañeros registrados o invitados sin cuenta.
              </Typography>
              <Autocomplete
                multiple
                options={userOptions}
                loading={searchingUsers}
                getOptionLabel={(o) => o.username}
                value={editTeamMembers}
                onChange={(_, v) => {
                  if (v.length <= teamSize - 1) setEditTeamMembers(v);
                }}
                onInputChange={(_, v) => searchUsers(v)}
                isOptionEqualToValue={(o, v) => o._id === v._id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={`Compañeros registrados (${editTeamMembers.length}/${teamSize - 1})`}
                    margin="normal"
                    helperText="Podés completar el resto del equipo con invitados sin cuenta"
                  />
                )}
              />
              {Array.from({ length: Math.max(0, teamSize - 1 - editTeamMembers.length) }).map((_, i) => (
                <TextField
                  key={i}
                  fullWidth
                  label={`Invitado ${i + 1} (nombre)`}
                  value={editTeamGuests[i] || ''}
                  onChange={(e) => {
                    const arr = [...editTeamGuests];
                    arr[i] = e.target.value;
                    setEditTeamGuests(arr);
                  }}
                  margin="dense"
                />
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setEditTeamOpen(false); setEditTeamMembers([]); setEditTeamGuests([]); }}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleEditTeam}>
              Guardar
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
            {leagueCapHint && (
              <Typography
                variant="body2"
                color={leagueCapHint.current >= leagueCapHint.limit ? 'error' : 'text.secondary'}
                sx={{ mb: 1 }}
              >
                Cupo de la liga: {leagueCapHint.current} de {leagueCapHint.limit} jugadores
                {leagueCapHint.current >= leagueCapHint.limit
                  ? ' — llegaste al tope de tu plan, esta alta puede rebotar'
                  : ''}
              </Typography>
            )}
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
                  Cruces de la primera ronda:
                </Typography>
                {drawPairings.map(([a, b], i) => (
                  <Typography key={a.teamId} variant="body2">
                    Cruce {i + 1}: {a.name} vs {b.name}
                  </Typography>
                ))}
                {drawResting.length > 0 && (
                  <Typography variant="body2">
                    Descansan: {drawResting.map((t) => t.name).join(', ')}
                  </Typography>
                )}
                <Button sx={{ mt: 2 }} size="small" onClick={() => setStartMode('manual')}>
                  Elegir cruces manualmente en su lugar
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
            {startMode === 'manual' && tournament.teams.length === numberOfTeams && (() => {
              const slots = firstRoundSlotsFor(numberOfTeams);
              // Todo equipo ya elegido en cualquier cruce o como "descansa",
              // para no ofrecerlo dos veces en otro selector.
              const allUsedIds = [...Object.values(pairings).flat(), ...restingIds].filter(Boolean);
              const availableExcluding = (currentId: string) =>
                tournament.teams.filter((t) => t.teamId === currentId || !allUsedIds.includes(t.teamId));
              return (
                <Box>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Elegí los 2 equipos para cada cruce de la primera ronda. Cada equipo
                    solo puede aparecer una vez.
                  </Typography>
                  {slots.map((slot, slotIdx) => (
                    <Box key={slot} sx={{ mb: 2 }}>
                      <Typography fontWeight="bold">Cruce {slotIdx + 1}</Typography>
                      {[0, 1].map((idx) => {
                        const available = availableExcluding(pairings[slot]?.[idx] ?? '');
                        return (
                          <FormControl fullWidth size="small" sx={{ my: 0.5 }} key={idx}>
                            <InputLabel>{`Equipo ${idx + 1}`}</InputLabel>
                            <Select
                              label={`Equipo ${idx + 1}`}
                              value={pairings[slot]?.[idx] ?? ''}
                              onChange={(e) => {
                                const next = { ...pairings };
                                next[slot] = [...(pairings[slot] ?? ['', ''])] as [string, string];
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
                  {restingIds.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography fontWeight="bold">Descansan la primera ronda</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        No entran en los cruces de arriba: pasan directo a la ronda siguiente.
                      </Typography>
                      {restingIds.map((value, restIdx) => {
                        const available = availableExcluding(value);
                        return (
                          <FormControl fullWidth size="small" sx={{ my: 0.5 }} key={restIdx}>
                            <InputLabel>{`Descansa ${restIdx + 1}`}</InputLabel>
                            <Select
                              label={`Descansa ${restIdx + 1}`}
                              value={value}
                              onChange={(e) => {
                                const next = [...restingIds];
                                next[restIdx] = e.target.value;
                                setRestingIds(next);
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
                  )}
                </Box>
              );
            })()}
            {startMode === 'manual' && tournament.teams.length !== numberOfTeams && (
              <Alert severity="info" sx={{ mt: 1 }}>
                En modo aleatorio de equipos, los equipos se generan recién al iniciar
                el torneo. Por eso, si querés asignar los cruces manualmente, tu torneo
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
          numberOfTeams={numberOfTeams}
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

        <MatchResultDialog
          open={!!resultTarget}
          onClose={() => setResultTarget(null)}
          match={resultTarget}
          teamNames={[
            resultTarget ? renderTeamName(resultTarget.teams[0]?.teamId) ?? 'Equipo 1' : 'Equipo 1',
            resultTarget ? renderTeamName(resultTarget.teams[1]?.teamId) ?? 'Equipo 2' : 'Equipo 2'
          ]}
          blockers={resultTarget ? downstreamBlockers(resultTarget, matches) : []}
          onSaved={handleMatchResultSaved}
        />
      </Container>
    </Box>
  );
};

export default TournamentDetails;
