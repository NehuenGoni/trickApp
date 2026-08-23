import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert
} from '@mui/material';
import API_ROUTES, { apiRequest, PaymentRequiredError } from '../config/api';
import { clearBillingCache } from '../hooks/useBilling';
import PlanLimitAlert from './PlanLimitAlert';

interface PickerTournament {
  _id: string;
  name: string;
  status: string;
  league?: { _id: string; name: string } | null;
}

interface LeagueTournamentPickerProps {
  open: boolean;
  leagueId: string;
  onClose: () => void;
  /** Se llama tras agregar el torneo con éxito, para que el padre refetchee el detalle. */
  onAdded: () => void;
}

/**
 * Filtra en cliente los torneos sin liga: un torneo pertenece a una sola
 * liga a la vez (ver `Tournament.league` y `attachTournament`, que rechaza
 * con 409 si el torneo ya está en otra liga), así que acá solo tiene sentido
 * ofrecer los que todavía no están en ninguna. Cuando haya cientos de
 * torneos esto se cambia por un filtro `?league=none` del lado del servidor;
 * hoy el volumen no lo justifica.
 */
const LeagueTournamentPicker: React.FC<LeagueTournamentPickerProps> = ({
  open,
  leagueId,
  onClose,
  onAdded
}) => {
  const [tournaments, setTournaments] = useState<PickerTournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PickerTournament | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // 402 de cupo de liga: vincular un torneo con jugadores puede sumar de
  // golpe a toda su gente (ver `enforceLeagueCap` en `attachTournament`,
  // backend). Aparte del error genérico porque necesita `canUpgrade`.
  const [planLimitError, setPlanLimitError] = useState<{ message: string; canUpgrade: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setPlanLimitError(null);
    setSelected(null);
    setLoading(true);
    (async () => {
      try {
        const data: PickerTournament[] = await apiRequest(API_ROUTES.TOURNAMENTS.LIST);
        setTournaments(data.filter((t) => !t.league));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar los torneos');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, leagueId]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    setPlanLimitError(null);
    try {
      await apiRequest(API_ROUTES.LEAGUES.LEAGUE_TOURNAMENT(leagueId, selected._id), {
        method: 'PUT'
      });
      onAdded();
      onClose();
    } catch (err) {
      if (err instanceof PaymentRequiredError && err.reason === 'league_member_limit_reached') {
        clearBillingCache();
        setPlanLimitError({ message: err.message, canUpgrade: !!err.canUpgrade });
        return;
      }
      setError(err instanceof Error ? err.message : 'Error al agregar el torneo a la liga');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Agregar torneo a la liga</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {planLimitError && (
          <PlanLimitAlert
            sx={{ mb: 2 }}
            severity="error"
            message={planLimitError.message}
            canUpgrade={planLimitError.canUpgrade}
          />
        )}
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <Autocomplete
            options={tournaments}
            getOptionLabel={(t) => t.name}
            isOptionEqualToValue={(a, b) => a._id === b._id}
            value={selected}
            onChange={(_, value) => setSelected(value)}
            noOptionsText="No hay torneos disponibles"
            renderInput={(params) => (
              <TextField {...params} label="Torneo" autoFocus margin="normal" />
            )}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selected || saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeagueTournamentPicker;
