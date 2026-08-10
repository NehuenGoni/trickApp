import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Paper,
  Grid,
  Typography,
  Chip,
  Alert,
  ButtonBase,
  CircularProgress,
  useMediaQuery,
  Theme
} from '@mui/material';
import API_ROUTES, { apiRequest } from '../config/api';
import { TeamFormationMode } from '../types/tournament';

// Espejo de TOURNAMENT_TEAMS_COUNT en backend/src/config/constants.ts. El
// resto del frontend también lo tiene hardcodeado en varios lugares
// (TournamentDetails.tsx), así que no rompe ninguna convención existente.
const TOURNAMENT_TEAMS_COUNT = 8;

export interface RosterPlayer {
  signupId?: string;
  playerId?: string;
  name: string;
  isGuest?: boolean;
}

export interface RosterTeam {
  teamId: string;
  name: string;
  registeredBy?: string;
  players: RosterPlayer[];
}

export interface TeamRosterEditorProps {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  mode: TeamFormationMode;
  teamSize: number;
  /** Equipos editables; el padre ya filtró los fijos (isDrawn === false). */
  teams: RosterTeam[];
  /** Inscriptos del pool que no están en ningún equipo. Vacío en user-formed. */
  unassigned: RosterPlayer[];
  /** Si ya había un sorteo de cruces guardado, para elegir el mensaje final. */
  hasDraft: boolean;
  /** Se llama tras el PUT exitoso con un mensaje ya armado; el padre refetchea. */
  onSaved: (message: string) => void;
}

type SlotRef = { at: number | 'bench'; index: number };

interface BoardState {
  teams: RosterTeam[];
  bench: RosterPlayer[];
}

const cloneTeam = (t: RosterTeam): RosterTeam => ({ ...t, players: t.players.map((p) => ({ ...p })) });
const cloneP = (p: RosterPlayer): RosterPlayer => ({ ...p });

const buildInitialTeams = (mode: TeamFormationMode, teams: RosterTeam[]): RosterTeam[] => {
  const existing = teams.map(cloneTeam);
  if (mode !== 'creator-formed') return existing;
  // En creator-formed se editan los 8 equipos desde el arranque, así que se
  // completan con placeholders vacíos (sin teamId, el backend les asigna uno).
  const placeholders: RosterTeam[] = [];
  for (let i = existing.length; i < TOURNAMENT_TEAMS_COUNT; i++) {
    placeholders.push({ teamId: '', name: `Equipo ${i + 1}`, players: [] });
  }
  return [...existing, ...placeholders];
};

const getPlayer = (state: BoardState, ref: SlotRef): RosterPlayer =>
  ref.at === 'bench' ? state.bench[ref.index] : state.teams[ref.at].players[ref.index];

const setPlayer = (state: BoardState, ref: SlotRef, player: RosterPlayer): BoardState => {
  if (ref.at === 'bench') {
    const bench = [...state.bench];
    bench[ref.index] = player;
    return { ...state, bench };
  }
  const teams = state.teams.map((t, i) => {
    if (i !== ref.at) return t;
    const players = [...t.players];
    players[ref.index] = player;
    return { ...t, players };
  });
  return { ...state, teams };
};

const swapSlots = (state: BoardState, a: SlotRef, b: SlotRef): BoardState => {
  const pa = getPlayer(state, a);
  const pb = getPlayer(state, b);
  return setPlayer(setPlayer(state, a, pb), b, pa);
};

const removeFromOrigin = (state: BoardState, ref: SlotRef): { player: RosterPlayer; next: BoardState } => {
  if (ref.at === 'bench') {
    const player = state.bench[ref.index];
    return { player, next: { ...state, bench: state.bench.filter((_, i) => i !== ref.index) } };
  }
  const team = state.teams[ref.at];
  const player = team.players[ref.index];
  const teams = state.teams.map((t, i) =>
    i === ref.at ? { ...t, players: t.players.filter((_, j) => j !== ref.index) } : t
  );
  return { player, next: { ...state, teams } };
};

const moveToTeam = (state: BoardState, from: SlotRef, teamIndex: number): BoardState => {
  const { player, next } = removeFromOrigin(state, from);
  const teams = next.teams.map((t, i) => (i === teamIndex ? { ...t, players: [...t.players, player] } : t));
  return { ...next, teams };
};

const moveToBench = (state: BoardState, from: SlotRef): BoardState => {
  if (from.at === 'bench') return state;
  const { player, next } = removeFromOrigin(state, from);
  return { ...next, bench: [...next.bench, player] };
};

const TeamRosterEditor: React.FC<TeamRosterEditorProps> = ({
  open,
  onClose,
  tournamentId,
  mode,
  teamSize,
  teams,
  unassigned,
  hasDraft,
  onSaved
}) => {
  const fullScreen = useMediaQuery((t: Theme) => t.breakpoints.down('sm'));
  const [draftTeams, setDraftTeams] = useState<RosterTeam[]>([]);
  const [bench, setBench] = useState<RosterPlayer[]>([]);
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [hint, setHint] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Solo se resetea cuando el diálogo pasa a abierto: si dependiera de `teams`
  // (nuevo array en cada render del padre) pisaría los cambios del usuario en
  // cualquier re-render mientras edita.
  useEffect(() => {
    if (!open) return;
    setDraftTeams(buildInitialTeams(mode, teams));
    setBench(unassigned.map(cloneP));
    setSelected(null);
    setHint('');
    setDirty(false);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allowBench = mode !== 'user-formed';

  const applyBoard = (fn: (state: BoardState) => BoardState) => {
    const state = fn({ teams: draftTeams, bench });
    setDraftTeams(state.teams);
    setBench(state.bench);
    setDirty(true);
    setHint('');
  };

  const handleTapPlayer = (ref: SlotRef) => {
    if (!selected) {
      setSelected(ref);
      setHint('');
      return;
    }
    if (selected.at === ref.at && selected.index === ref.index) {
      setSelected(null);
      return;
    }
    applyBoard((state) => swapSlots(state, selected, ref));
    setSelected(null);
  };

  const handleTapEmptySlot = (teamIndex: number) => {
    if (!selected) return;
    applyBoard((state) => moveToTeam(state, selected, teamIndex));
    setSelected(null);
  };

  const handleTapFullTeam = (team: RosterTeam) => {
    if (!selected || team.players.length < teamSize) return;
    setHint('Ese equipo está completo. Tocá un jugador para intercambiarlos.');
  };

  const handleTapBench = () => {
    if (!selected || !allowBench) return;
    applyBoard((state) => moveToBench(state, selected));
    setSelected(null);
  };

  const isSelected = (ref: SlotRef) => !!selected && selected.at === ref.at && selected.index === ref.index;

  const handleDiscard = () => {
    setDraftTeams(buildInitialTeams(mode, teams));
    setBench(unassigned.map(cloneP));
    setSelected(null);
    setHint('');
    setDirty(false);
    setError('');
  };

  const handleClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        teams: draftTeams
          .filter((t) => t.players.length > 0)
          .map((t) => ({
            ...(t.teamId ? { teamId: t.teamId } : {}),
            players: t.players.map((p) => ({
              ...(p.signupId ? { signupId: p.signupId } : {}),
              ...(p.playerId ? { playerId: p.playerId } : {}),
              name: p.name,
              isGuest: !!p.isGuest
            }))
          }))
      };
      const res = await apiRequest(API_ROUTES.TOURNAMENTS.ROSTER(tournamentId), {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const message = !hasDraft
        ? 'Equipos actualizados'
        : res?.draftInvalidated
        ? 'Equipos actualizados. Se limpió el sorteo de cruces porque cambiaron los equipos: volvé a sortear antes de iniciar.'
        : 'Equipos actualizados. Los cruces de cuartos no cambian: siguen siendo los mismos equipos, con los jugadores nuevos.';
      onSaved(message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar los equipos');
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === 'creator-formed' ? 'Armar equipos' : mode === 'random' ? 'Editar equipos sorteados' : 'Reorganizar jugadores';

  const selectedPlayer = selected ? getPlayer({ teams: draftTeams, bench }, selected) : null;
  const benchCount = bench.length;

  const renderPlayerRow = (ref: SlotRef, player: RosterPlayer) => (
    <ButtonBase
      key={`${ref.at}-${ref.index}`}
      onClick={(e) => {
        e.stopPropagation();
        handleTapPlayer(ref);
      }}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        minHeight: 44,
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        textAlign: 'left',
        border: '2px solid',
        borderColor: isSelected(ref) ? '#fbc02d' : 'transparent',
        boxShadow: isSelected(ref) ? '0 0 0 4px rgba(251,192,45,0.15)' : 'none'
      }}
    >
      <Typography variant="body2">{player.name}</Typography>
      {player.isGuest && <Chip size="small" variant="outlined" label="Invitado" />}
    </ButtonBase>
  );

  const renderEmptySlot = (teamIndex: number, key: number) => (
    <Box
      key={key}
      onClick={(e) => {
        e.stopPropagation();
        handleTapEmptySlot(teamIndex);
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        px: 1.5,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: selected ? 'success.main' : 'divider',
        color: 'text.secondary',
        cursor: selected ? 'pointer' : 'default'
      }}
    >
      <Typography variant="caption">Lugar libre</Typography>
    </Box>
  );

  const renderTeamCard = (team: RosterTeam, index: number) => {
    const full = team.players.length >= teamSize;
    const emptySlots = Math.max(0, teamSize - team.players.length);
    return (
      <Grid item xs={12} sm={6} key={team.teamId || `placeholder-${index}`}>
        <Paper
          variant="outlined"
          data-testid={`roster-team-${index}`}
          onClick={() => handleTapFullTeam(team)}
          sx={{
            p: 1.5,
            height: '100%',
            borderColor: selected && !full ? 'success.main' : undefined,
            borderStyle: selected && !full ? 'dashed' : undefined,
            opacity: selected && full && !team.players.some((_, i) => isSelected({ at: index, index: i })) ? 0.85 : 1
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2">{team.name}</Typography>
            {team.registeredBy && <Chip size="small" variant="outlined" label="Inscripto por un jugador" />}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {team.players.map((p, i) => renderPlayerRow({ at: index, index: i }, p))}
            {Array.from({ length: emptySlots }).map((_, i) => renderEmptySlot(index, i))}
          </Box>
        </Paper>
      </Grid>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {mode === 'user-formed' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Estos equipos los inscribieron los propios jugadores. Si movés a alguien, estás
              cambiando un equipo que ellos armaron. Avisales antes de iniciar el torneo.
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Tocá un jugador para seleccionarlo y después tocá a otro para intercambiarlos, o un
            equipo con lugar libre para moverlo ahí{allowBench ? ', o el banco para dejarlo sin asignar' : ''}.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 32, mb: 1 }}>
            {selectedPlayer && (
              <>
                <Chip size="small" color="warning" label={`Seleccionado: ${selectedPlayer.name}`} />
                <Button size="small" onClick={() => setSelected(null)}>
                  Cancelar selección
                </Button>
              </>
            )}
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </Box>

          <Grid container spacing={1.5}>
            {draftTeams.map((team, index) => renderTeamCard(team, index))}
          </Grid>

          {allowBench && (
            <Box
              data-testid="roster-bench"
              onClick={handleTapBench}
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                border: '1px dashed',
                borderColor: selected ? 'success.main' : 'divider',
                cursor: selected ? 'pointer' : 'default'
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Sin asignar ({benchCount})
              </Typography>
              {benchCount === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No hay jugadores sin asignar.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {bench.map((p, i) => renderPlayerRow({ at: 'bench', index: i }, p))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Button onClick={handleDiscard} disabled={!dirty || saving}>
            Descartar cambios
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleClose} disabled={saving}>
              Cerrar
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!dirty || saving}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              Guardar cambios
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Descartar cambios</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Tenés cambios sin guardar. ¿Descartarlos?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscard(false)}>Seguir editando</Button>
          <Button
            color="error"
            onClick={() => {
              setConfirmDiscard(false);
              onClose();
            }}
          >
            Descartar y cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TeamRosterEditor;
