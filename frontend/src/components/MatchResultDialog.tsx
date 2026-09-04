import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  useMediaQuery,
  Theme
} from '@mui/material';
import API_ROUTES, { apiRequest, MatchResultConflictError } from '../config/api';
import { MAX_SCORE } from '../utils/truco';
import { slotLabel } from '../utils/tournament';

export interface MatchResultTeam {
  teamId: string;
  score: number;
}

export interface MatchResultMatchLike {
  _id: string;
  status: string;
  winner?: string;
  teams: MatchResultTeam[];
}

export interface MatchResultBlocker {
  _id: string;
  phase?: string;
  bracketSlot?: string;
}

export interface MatchResultDialogProps {
  open: boolean;
  onClose: () => void;
  match: MatchResultMatchLike | null;
  /** Nombre de cada equipo, en el mismo orden que `match.teams`. */
  teamNames: [string, string];
  /**
   * Bloqueadores calculados en el cliente con `downstreamBlockers` (para
   * mostrar el aviso apenas se abre, sin esperar a guardar). El backend
   * vuelve a validar esto mismo al recibir el pedido — si esta lista está
   * desactualizada, en el peor caso el aviso inicial no aparece y el 409 del
   * servidor lo muestra igual.
   */
  blockers: MatchResultBlocker[];
  /** Se llama tras guardar/deshacer con éxito; el padre refetchea y muestra el mensaje. */
  onSaved: (message: string) => void;
}

const blockerName = (b: MatchResultBlocker) => slotLabel(b.bracketSlot ?? b.phase ?? '');

const MatchResultDialog: React.FC<MatchResultDialogProps> = ({
  open,
  onClose,
  match,
  teamNames,
  blockers,
  onSaved
}) => {
  const fullScreen = useMediaQuery((t: Theme) => t.breakpoints.down('sm'));
  const [scores, setScores] = useState<[string, string]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflictBlockers, setConflictBlockers] = useState<MatchResultBlocker[] | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<{
    action: 'save' | 'clear';
    affectedPlayers: number;
  } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);

  useEffect(() => {
    if (!open || !match) return;
    setScores([String(match.teams[0]?.score ?? 0), String(match.teams[1]?.score ?? 0)]);
    setError('');
    setConflictBlockers(null);
    setConfirmReopen(null);
    setConfirmUndo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, match?._id]);

  if (!match) return null;

  const wasFinished = match.status === 'finished';
  const parsed = scores.map((s) => (s.trim() === '' ? NaN : Number(s)));
  const winnerIndex = parsed[0] === MAX_SCORE ? 0 : parsed[1] === MAX_SCORE ? 1 : null;
  const winnerChanges = winnerIndex !== null && match.teams[winnerIndex]?.teamId !== match.winner;

  const validate = (): string | null => {
    for (const n of parsed) {
      if (!Number.isInteger(n) || n < 0 || n > MAX_SCORE) {
        return `Los marcadores tienen que ser números enteros entre 0 y ${MAX_SCORE}`;
      }
    }
    if (winnerIndex === null) {
      return `Uno de los dos equipos (y solo uno) tiene que llegar a ${MAX_SCORE} para cargar el resultado`;
    }
    return null;
  };

  const buildScoresPayload = () => [
    { teamId: match.teams[0].teamId, score: parsed[0] },
    { teamId: match.teams[1].teamId, score: parsed[1] }
  ];

  const handleSave = async (withConfirmReopen = false) => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    setConflictBlockers(null);
    try {
      const res = await apiRequest(API_ROUTES.MATCHES.SET_RESULT(match._id), {
        method: 'PUT',
        body: JSON.stringify({ scores: buildScoresPayload(), confirmReopen: withConfirmReopen })
      });
      onSaved(res?.message ?? (wasFinished ? 'Resultado corregido' : 'Resultado cargado'));
      onClose();
    } catch (err) {
      if (err instanceof MatchResultConflictError) {
        if (err.blockers) {
          setConflictBlockers(err.blockers);
        } else if (err.requiresConfirmation) {
          setConfirmReopen({ action: 'save', affectedPlayers: err.impact?.affectedPlayers ?? 0 });
        }
        return;
      }
      setError(err instanceof Error ? err.message : 'Error al cargar el resultado');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (withConfirmReopen = false) => {
    setSaving(true);
    setError('');
    setConflictBlockers(null);
    try {
      const res = await apiRequest(
        `${API_ROUTES.MATCHES.CLEAR_RESULT(match._id)}${withConfirmReopen ? '?confirmReopen=true' : ''}`,
        { method: 'DELETE' }
      );
      onSaved(res?.message ?? 'Resultado deshecho');
      onClose();
    } catch (err) {
      if (err instanceof MatchResultConflictError) {
        if (err.blockers) {
          setConflictBlockers(err.blockers);
        } else if (err.requiresConfirmation) {
          setConfirmReopen({ action: 'clear', affectedPlayers: err.impact?.affectedPlayers ?? 0 });
        }
        return;
      }
      setError(err instanceof Error ? err.message : 'Error al deshacer el resultado');
    } finally {
      setSaving(false);
    }
  };

  const effectiveBlockers = conflictBlockers ?? (wasFinished ? blockers : []);
  const title = wasFinished ? 'Corregir resultado' : 'Anotar resultado';

  return (
    <>
      <Dialog open={open && !confirmReopen && !confirmUndo} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth fullScreen={fullScreen}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {effectiveBlockers.length > 0 && (
            <Alert severity={winnerChanges ? 'error' : 'info'} sx={{ mb: 2 }}>
              {winnerChanges ? 'No se puede cambiar el ganador: ' : 'Ya se jugó el partido siguiente: '}
              {effectiveBlockers.map(blockerName).join(', ')}. Para tocar el ganador de este partido, primero
              deshacé el resultado de {effectiveBlockers.length === 1 ? 'ese' : 'esos'}.
              {!winnerChanges && ' Todavía podés corregir el marcador sin cambiar quién ganó.'}
            </Alert>
          )}

          {wasFinished && !winnerChanges && effectiveBlockers.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Este partido ya está finalizado. Si cambiás el marcador de forma que gane el otro equipo, el
              partido siguiente del cuadro se actualiza solo (o se bloquea si ya se jugó).
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {[0, 1].map((i) => (
              <TextField
                key={i}
                label={teamNames[i] || 'Equipo'}
                type="number"
                value={scores[i]}
                onChange={(e) => setScores((s) => (i === 0 ? [e.target.value, s[1]] : [s[0], e.target.value]))}
                inputProps={{ min: 0, max: MAX_SCORE }}
                fullWidth
                disabled={saving}
              />
            ))}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {winnerIndex !== null
              ? `Gana: ${teamNames[winnerIndex] || 'Equipo'}`
              : `Uno de los dos tiene que llegar a ${MAX_SCORE}`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          {wasFinished ? (
            <Button color="error" onClick={() => setConfirmUndo(true)} disabled={saving}>
              Deshacer resultado
            </Button>
          ) : (
            <span />
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => handleSave(false)}
              disabled={saving || (winnerChanges && effectiveBlockers.length > 0)}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              Guardar
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmReopen} onClose={() => setConfirmReopen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>El torneo ya está cerrado</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1 }}>
            {confirmReopen?.action === 'clear'
              ? 'Deshacer este resultado va a reabrir el torneo'
              : 'Corregir este resultado va a reabrir el torneo'}{' '}
            y recalcular el ranking
            {confirmReopen && confirmReopen.affectedPlayers > 0
              ? ` de ${confirmReopen.affectedPlayers} jugador${confirmReopen.affectedPlayers === 1 ? '' : 'es'}`
              : ''}
            .
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReopen(null)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => (confirmReopen?.action === 'clear' ? handleClear(true) : handleSave(true))}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            Sí, confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmUndo} onClose={() => setConfirmUndo(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Deshacer resultado</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            El partido vuelve a quedar en curso, sin ganador ni marcador. Vas a tener que volver a cargarlo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUndo(false)} disabled={saving}>
            Seguir corrigiendo
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmUndo(false);
              handleClear(false);
            }}
            disabled={saving}
          >
            Deshacer resultado
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MatchResultDialog;
