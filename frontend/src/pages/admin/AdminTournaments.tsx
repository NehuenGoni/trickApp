import React, { useCallback, useEffect, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Chip,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Stack,
  Tooltip,
  Divider,
  FormControlLabel,
  Checkbox,
  TablePagination
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  RestartAlt as ResetIcon,
  Flag as CloseIcon,
  Calculate as RecalcIcon,
  SportsEsports as MatchIcon
} from '@mui/icons-material';
import AdminLayout from './AdminLayout';
import API_ROUTES, { apiRequest } from '../../config/api';

type TournamentStatus = 'upcoming' | 'in_progress' | 'completed';

interface AdminTournament {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  status: TournamentStatus;
  type: 'grand-slam' | 'master-1000';
  format: 'duos' | 'trios';
  teamFormationMode: 'user-formed' | 'random';
  pointsAwarded: boolean;
  teams: Array<{ teamId: string; name: string; isDrawn?: boolean }>;
  individualSignups?: Array<{ name: string }>;
  matches?: string[];
  createdBy?: { _id: string; username: string } | string;
}

interface AdminMatch {
  _id: string;
  status: 'pending' | 'in_progress' | 'finished';
  phase?: string;
  bracketSlot?: string;
  winner?: string;
  teams: Array<{
    teamId: string;
    score: number;
    players: Array<{ username?: string; isGuest?: boolean }>;
  }>;
}

const STATUS_LABEL: Record<TournamentStatus, string> = {
  upcoming: 'Inscripciones abiertas',
  in_progress: 'En curso',
  completed: 'Finalizado'
};

const STATUS_STYLE: Record<TournamentStatus, object> = {
  upcoming: { bgcolor: 'info.main', color: 'info.contrastText' },
  in_progress: { bgcolor: '#D4AF37', color: '#000' },
  completed: { bgcolor: 'success.main', color: 'success.contrastText' }
};

const MATCH_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  finished: 'Finalizado'
};

const emptyEditForm = {
  name: '',
  description: '',
  startDate: '',
  type: 'master-1000' as AdminTournament['type'],
  format: 'duos' as AdminTournament['format'],
  teamFormationMode: 'user-formed' as AdminTournament['teamFormationMode']
};

const teamLabel = (team: AdminMatch['teams'][number]) =>
  team.players.map((p) => p.username || 'Invitado').join(' / ') || 'Equipo';

const AdminTournaments = () => {
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminTournament | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [resetTarget, setResetTarget] = useState<AdminTournament | null>(null);
  const [unmakeTeams, setUnmakeTeams] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminTournament | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    tournament: AdminTournament;
    kind: 'close' | 'recalculate';
  } | null>(null);

  const [matchesTarget, setMatchesTarget] = useState<AdminTournament | null>(null);
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchDraft, setMatchDraft] = useState<
    Record<string, { scores: Record<string, string>; winner: string; status: string }>
  >({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.TOURNAMENTS, {
        params: {
          page: page + 1,
          limit,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined
        }
      });
      setTournaments(data.tournaments);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los torneos');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const runAction = async (
    url: string,
    options: RequestInit,
    fallbackMessage: string
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const data = await apiRequest(url, options);
      setSuccess(data?.message || fallbackMessage);
      setError('');
      fetchTournaments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (tournament: AdminTournament) => {
    setEditTarget(tournament);
    setEditForm({
      name: tournament.name,
      description: tournament.description || '',
      startDate: new Date(tournament.startDate).toISOString().slice(0, 16),
      type: tournament.type,
      format: tournament.format,
      teamFormationMode: tournament.teamFormationMode
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const ok = await runAction(
      API_ROUTES.ADMIN.TOURNAMENT(editTarget._id),
      {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          startDate: new Date(editForm.startDate).toISOString()
        })
      },
      'Torneo actualizado'
    );
    if (ok) setEditTarget(null);
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    const ok = await runAction(
      API_ROUTES.ADMIN.TOURNAMENT_RESET(resetTarget._id),
      { method: 'POST', body: JSON.stringify({ unmakeTeams }) },
      'Torneo reseteado'
    );
    if (ok) {
      setResetTarget(null);
      setUnmakeTeams(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { tournament, kind } = confirmAction;
    const url =
      kind === 'close'
        ? API_ROUTES.ADMIN.TOURNAMENT_CLOSE(tournament._id)
        : API_ROUTES.ADMIN.TOURNAMENT_RECALCULATE(tournament._id);
    const ok = await runAction(url, { method: 'POST' }, 'Acción aplicada');
    if (ok) setConfirmAction(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await runAction(
      API_ROUTES.ADMIN.TOURNAMENT(deleteTarget._id),
      { method: 'DELETE' },
      'Torneo eliminado'
    );
    if (ok) setDeleteTarget(null);
  };

  const openMatches = async (tournament: AdminTournament) => {
    setMatchesTarget(tournament);
    setMatchesLoading(true);
    try {
      const data: AdminMatch[] = await apiRequest(
        API_ROUTES.ADMIN.TOURNAMENT_MATCHES(tournament._id)
      );
      setMatches(data);
      const draft: typeof matchDraft = {};
      for (const match of data) {
        draft[match._id] = {
          scores: Object.fromEntries(match.teams.map((t) => [t.teamId, String(t.score)])),
          winner: match.winner || '',
          status: match.status
        };
      }
      setMatchDraft(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los partidos');
      setMatchesTarget(null);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleSaveMatch = async (match: AdminMatch) => {
    const draft = matchDraft[match._id];
    if (!draft) return;
    setSaving(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.MATCH(match._id), {
        method: 'PUT',
        body: JSON.stringify({
          scores: match.teams.map((t) => ({
            teamId: t.teamId,
            score: Number(draft.scores[t.teamId] ?? t.score)
          })),
          winner: draft.winner || null,
          status: draft.status
        })
      });
      setSuccess(data?.message || 'Partido actualizado');
      setError('');
      if (matchesTarget) await openMatches(matchesTarget);
      fetchTournaments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el partido');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMatch = async (match: AdminMatch) => {
    setSaving(true);
    try {
      await apiRequest(API_ROUTES.ADMIN.MATCH(match._id), { method: 'DELETE' });
      setSuccess('Partido eliminado');
      if (matchesTarget) await openMatches(matchesTarget);
      fetchTournaments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el partido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Torneos"
      subtitle="Editá cualquier torneo sin importar quién lo creó ni en qué estado esté."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <TextField
            select
            size="small"
            label="Estado"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="upcoming">Inscripciones abiertas</MenuItem>
            <MenuItem value="in_progress">En curso</MenuItem>
            <MenuItem value="completed">Finalizados</MenuItem>
          </TextField>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : tournaments.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No se encontraron torneos.
          </Typography>
        ) : (
          tournaments.map((tournament) => (
            <Paper
              key={tournament._id}
              elevation={1}
              sx={{ p: 2, mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 2,
                  mb: 1
                }}
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {tournament.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(tournament.startDate).toLocaleDateString('es-AR')}
                    {typeof tournament.createdBy === 'object' && tournament.createdBy
                      ? ` · Organiza ${tournament.createdBy.username}`
                      : ''}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={STATUS_LABEL[tournament.status]}
                  sx={STATUS_STYLE[tournament.status]}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip size="small" label={tournament.type === 'grand-slam' ? 'Grand Slam' : 'Master 1000'} />
                <Chip size="small" label={tournament.format === 'duos' ? 'Duos' : 'Tríos'} />
                <Chip
                  size="small"
                  label={tournament.teamFormationMode === 'random' ? 'Equipos sorteados' : 'Equipos armados'}
                />
                <Chip size="small" label={`${tournament.teams?.length || 0} equipos`} />
                <Chip size="small" label={`${tournament.matches?.length || 0} partidos`} />
                {tournament.pointsAwarded && (
                  <Chip size="small" color="success" label="Puntos otorgados" />
                )}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: { xs: 'center', sm: 'flex-end' },
                  gap: 0.5,
                  pt: 1,
                  borderTop: 1,
                  borderColor: 'divider',
                  flexWrap: 'wrap'
                }}
              >
                <Tooltip title="Editar datos del torneo">
                  <IconButton onClick={() => openEdit(tournament)} sx={{ color: '#4f49cd' }}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Partidos y resultados">
                  <span>
                    <IconButton
                      disabled={!tournament.matches?.length}
                      onClick={() => openMatches(tournament)}
                      sx={{ color: '#D4AF37' }}
                    >
                      <MatchIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Recalcular puntos desde los resultados">
                  <IconButton
                    onClick={() => setConfirmAction({ tournament, kind: 'recalculate' })}
                    sx={{ color: 'info.main' }}
                  >
                    <RecalcIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Forzar cierre y repartir puntos">
                  <span>
                    <IconButton
                      disabled={tournament.status === 'completed' && tournament.pointsAwarded}
                      onClick={() => setConfirmAction({ tournament, kind: 'close' })}
                      sx={{ color: 'success.main' }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Resetear a inscripciones abiertas">
                  <IconButton
                    onClick={() => {
                      setResetTarget(tournament);
                      setUnmakeTeams(false);
                    }}
                    sx={{ color: 'warning.main' }}
                  >
                    <ResetIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar torneo">
                  <IconButton onClick={() => setDeleteTarget(tournament)} sx={{ color: 'error.main' }}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>
          ))
        )}

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={limit}
          onRowsPerPageChange={(e) => {
            setLimit(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Paper>

      {/* Editar torneo */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar torneo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Descripción"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Fecha de inicio"
              type="datetime-local"
              value={editForm.startDate}
              onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Tipo"
              value={editForm.type}
              onChange={(e) =>
                setEditForm({ ...editForm, type: e.target.value as AdminTournament['type'] })
              }
              fullWidth
              helperText="Cambiar el tipo recalcula los puntos si el torneo ya los repartió"
            >
              <MenuItem value="master-1000">Master 1000</MenuItem>
              <MenuItem value="grand-slam">Grand Slam</MenuItem>
            </TextField>
            <TextField
              select
              label="Formato"
              value={editForm.format}
              onChange={(e) =>
                setEditForm({ ...editForm, format: e.target.value as AdminTournament['format'] })
              }
              fullWidth
              disabled={
                (editTarget?.teams.length || 0) > 0 ||
                (editTarget?.individualSignups?.length || 0) > 0
              }
              helperText="Bloqueado si ya hay equipos o inscriptos"
            >
              <MenuItem value="duos">Duos</MenuItem>
              <MenuItem value="trios">Tríos</MenuItem>
            </TextField>
            <TextField
              select
              label="Formación de equipos"
              value={editForm.teamFormationMode}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  teamFormationMode: e.target.value as AdminTournament['teamFormationMode']
                })
              }
              fullWidth
              disabled={
                (editTarget?.teams.length || 0) > 0 ||
                (editTarget?.individualSignups?.length || 0) > 0
              }
              helperText="Bloqueado si ya hay equipos o inscriptos"
            >
              <MenuItem value="user-formed">Los jugadores arman su equipo</MenuItem>
              <MenuItem value="random">Sorteo de equipos</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancelar</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={saving}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Partidos del torneo */}
      <Dialog
        open={!!matchesTarget}
        onClose={() => setMatchesTarget(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Partidos · {matchesTarget?.name}</DialogTitle>
        <DialogContent>
          {matchesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : matches.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              Este torneo no tiene partidos generados.
            </Typography>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Cambiar el ganador de un partido ya finalizado revierte las rondas siguientes del
                cuadro y, si el torneo estaba cerrado, descuenta los puntos otorgados.
              </Alert>
              {matches.map((match) => {
                const draft = matchDraft[match._id];
                if (!draft) return null;
                return (
                  <Paper key={match._id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1.5,
                        flexWrap: 'wrap'
                      }}
                    >
                      <Typography variant="subtitle2">
                        {match.bracketSlot || 'Partido'}
                        {match.phase ? ` · ${match.phase}` : ''}
                      </Typography>
                      <Chip size="small" label={MATCH_STATUS_LABEL[match.status] || match.status} />
                    </Box>

                    {match.teams.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Todavía sin equipos asignados.
                      </Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {match.teams.map((team) => (
                          <Box
                            key={team.teamId}
                            sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                          >
                            <Typography variant="body2" sx={{ flexGrow: 1 }}>
                              {teamLabel(team)}
                            </Typography>
                            <TextField
                              size="small"
                              type="number"
                              label="Puntos"
                              value={draft.scores[team.teamId] ?? ''}
                              onChange={(e) =>
                                setMatchDraft({
                                  ...matchDraft,
                                  [match._id]: {
                                    ...draft,
                                    scores: { ...draft.scores, [team.teamId]: e.target.value }
                                  }
                                })
                              }
                              sx={{ width: 110 }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    )}

                    <Divider sx={{ my: 1.5 }} />

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      alignItems={{ sm: 'center' }}
                    >
                      <TextField
                        select
                        size="small"
                        label="Estado"
                        value={draft.status}
                        onChange={(e) =>
                          setMatchDraft({
                            ...matchDraft,
                            [match._id]: { ...draft, status: e.target.value }
                          })
                        }
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="pending">Pendiente</MenuItem>
                        <MenuItem value="in_progress">En curso</MenuItem>
                        <MenuItem value="finished">Finalizado</MenuItem>
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label="Ganador"
                        value={draft.winner}
                        onChange={(e) =>
                          setMatchDraft({
                            ...matchDraft,
                            [match._id]: { ...draft, winner: e.target.value }
                          })
                        }
                        sx={{ minWidth: 220, flexGrow: 1 }}
                        disabled={match.teams.length < 2}
                      >
                        <MenuItem value="">Sin definir</MenuItem>
                        {match.teams.map((team) => (
                          <MenuItem key={team.teamId} value={team.teamId}>
                            {teamLabel(team)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={saving}
                        onClick={() => handleSaveMatch(match)}
                      >
                        Guardar
                      </Button>
                      <Button
                        color="error"
                        size="small"
                        disabled={saving}
                        onClick={() => handleDeleteMatch(match)}
                      >
                        Eliminar
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatchesTarget(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Reset */}
      <Dialog open={!!resetTarget} onClose={() => setResetTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Resetear torneo</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{resetTarget?.name}</strong> volverá al estado de inscripciones abiertas. Se
            eliminan todos sus partidos, se borra el ranking del torneo y se descuentan del ranking
            global los puntos que hubiera otorgado.
          </DialogContentText>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox checked={unmakeTeams} onChange={(e) => setUnmakeTeams(e.target.checked)} />
            }
            label={
              resetTarget?.teamFormationMode === 'random'
                ? 'Deshacer también los equipos sorteados'
                : 'Eliminar también los equipos inscriptos'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetTarget(null)}>Cancelar</Button>
          <Button onClick={handleReset} color="warning" variant="contained" disabled={saving}>
            Resetear
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cerrar / recalcular */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {confirmAction?.kind === 'close' ? 'Forzar cierre' : 'Recalcular puntos'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction?.kind === 'close'
              ? `Se cerrará "${confirmAction?.tournament.name}" con los resultados cargados hasta ahora y se repartirán los puntos correspondientes, aunque el cuadro esté incompleto.`
              : `Se descontarán los puntos que "${confirmAction?.tournament.name}" había otorgado y se volverán a calcular desde los resultados actuales.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Cancelar</Button>
          <Button onClick={handleConfirmAction} variant="contained" disabled={saving}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Eliminar */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Eliminar torneo</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar <strong>{deleteTarget?.name}</strong> y todos sus partidos? Si el torneo había
            repartido puntos, se descuentan del ranking global. Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={saving}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTournaments;
