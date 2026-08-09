import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  MenuItem,
  Tooltip,
  Stack,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  SwapHoriz as ChangePlanIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import AdminLayout from './AdminLayout';
import SurfaceCard from '../../components/SurfaceCard';
import API_ROUTES, { apiRequest } from '../../config/api';
import { PLAN_DEFINITIONS, PlanId, planById, arsPrice } from '../../config/plans';
import usePricing from '../../hooks/usePricing';

const MONTHS_PER_INTERVAL: Record<'monthly' | 'quarterly' | 'yearly', number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12
};

/** Monto sugerido en pesos para precargar el campo `amount`: el admin puede pisarlo. */
const suggestedAmount = (
  plan: PlanId,
  interval: 'monthly' | 'quarterly' | 'yearly',
  usdToArs: number | null
): string => {
  if (!usdToArs) return '';
  const def = planById(plan);
  if (def.priceUsdMonthly === null) return '';
  const usd =
    interval === 'yearly'
      ? def.priceUsdYearly ?? def.priceUsdMonthly * 12
      : def.priceUsdMonthly * MONTHS_PER_INTERVAL[interval];
  return String(arsPrice(usd, usdToArs));
};

interface SubscriptionUser {
  _id: string;
  username: string;
  email: string;
  billing: {
    plan: PlanId;
    status: string;
    currentPeriodEnd: string | null;
    usage: { periodKey: string; tournamentsCreated: number; tournamentsTotal: number };
  };
  isActive: boolean;
}

interface UserOption {
  _id: string;
  username: string;
  email?: string;
}

interface HistoryEntry {
  _id: string;
  plan: PlanId;
  amount?: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
}

const PLAN_LABEL: Record<PlanId, string> = {
  free: 'Free',
  basico: 'Básico',
  club: 'Club',
  pro: 'Pro'
};

const STATUS_LABEL: Record<string, string> = {
  none: 'Sin activar',
  active: 'Activa',
  past_due: 'Pago pendiente',
  canceled: 'Cancelada',
  expired: 'Vencida'
};

const AdminSubscriptions = () => {
  const { usdToArs } = usePricing();
  const [users, setUsers] = useState<SubscriptionUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Buscador para dar de alta la PRIMERA suscripción de alguien: el listado
  // principal solo trae usuarios que ya tienen algo pago (ver adminBilling.controller.ts).
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [newSubscriptionTarget, setNewSubscriptionTarget] = useState<UserOption | null>(null);

  const [grantTarget, setGrantTarget] = useState<SubscriptionUser | UserOption | null>(null);
  const [grantForm, setGrantForm] = useState({ plan: 'basico' as PlanId, interval: 'monthly' as 'monthly' | 'quarterly' | 'yearly', months: '1', amount: '' });

  const [changePlanTarget, setChangePlanTarget] = useState<SubscriptionUser | null>(null);
  const [changePlanValue, setChangePlanValue] = useState<PlanId>('free');

  const [historyTarget, setHistoryTarget] = useState<SubscriptionUser | null>(null);
  const [history, setHistory] = useState<{ subscriptions: HistoryEntry[]; payments: HistoryEntry[] } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.SUBSCRIPTIONS, {
        params: { page: page + 1, limit, search: debouncedSearch || undefined }
      });
      setUsers(data.users);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las suscripciones');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const openGrantDialog = (target: SubscriptionUser | UserOption) => {
    setGrantTarget(target);
    setGrantForm({
      plan: 'basico',
      interval: 'monthly',
      months: String(MONTHS_PER_INTERVAL.monthly),
      amount: suggestedAmount('basico', 'monthly', usdToArs)
    });
  };

  /** Al cambiar plan o intervalo, resugiere `months` y `amount` — el admin puede seguir pisándolos a mano. */
  const updateGrantSelection = (changes: Partial<Pick<typeof grantForm, 'plan' | 'interval'>>) => {
    setGrantForm((prev) => {
      const next = { ...prev, ...changes };
      return {
        ...next,
        months: String(MONTHS_PER_INTERVAL[next.interval]),
        amount: suggestedAmount(next.plan, next.interval, usdToArs)
      };
    });
  };

  const handleGrant = async () => {
    if (!grantTarget) return;
    const months = parseInt(grantForm.months, 10);
    if (!months || months <= 0) {
      setError('`Meses` debe ser un entero mayor a 0');
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.USER_SUBSCRIPTION(grantTarget._id), {
        method: 'POST',
        body: JSON.stringify({
          plan: grantForm.plan,
          interval: grantForm.interval,
          months,
          ...(grantForm.amount ? { amount: Number(grantForm.amount) } : {})
        })
      });
      setSuccess(data?.message || 'Suscripción activada');
      setGrantTarget(null);
      setNewSubscriptionTarget(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar la suscripción');
    } finally {
      setSaving(false);
    }
  };

  const openChangePlan = (target: SubscriptionUser) => {
    setChangePlanTarget(target);
    setChangePlanValue(target.billing.plan);
  };

  const handleChangePlan = async () => {
    if (!changePlanTarget) return;
    setSaving(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.USER_PLAN(changePlanTarget._id), {
        method: 'PUT',
        body: JSON.stringify({ plan: changePlanValue })
      });
      setSuccess(data?.message || 'Plan actualizado');
      setChangePlanTarget(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar el plan');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (target: SubscriptionUser) => {
    setHistoryTarget(target);
    setLoadingHistory(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.USER_BILLING(target._id));
      setHistory({ subscriptions: data.subscriptions, payments: data.payments });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <AdminLayout
      title="Suscripciones"
      subtitle="Activá o extendé un plan tras recibir el pago por transferencia, y llevá el historial de cada cliente."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <SurfaceCard sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Activar la primera suscripción de alguien
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Autocomplete
            sx={{ flexGrow: 1 }}
            size="small"
            options={userOptions}
            loading={searchingUsers}
            getOptionLabel={(o) => `${o.username}${o.email ? ` (${o.email})` : ''}`}
            value={newSubscriptionTarget}
            onChange={(_, v) => setNewSubscriptionTarget(v)}
            onInputChange={(_, v) => searchUsers(v)}
            isOptionEqualToValue={(o, v) => o._id === v._id}
            renderInput={(params) => <TextField {...params} label="Buscar usuario por nombre o email" />}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!newSubscriptionTarget}
            onClick={() => newSubscriptionTarget && openGrantDialog(newSubscriptionTarget)}
          >
            Activar
          </Button>
        </Box>
      </SurfaceCard>

      <SurfaceCard sx={{ p: { xs: 2, md: 3 } }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar entre quienes ya tienen un plan pago…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : users.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            Todavía nadie tiene un plan pago. Usá el buscador de arriba para activar el primero.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Vence</TableCell>
                  <TableCell align="right">Uso del mes</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{u.username}</Typography>
                      <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    </TableCell>
                    <TableCell>{PLAN_LABEL[u.billing.plan]}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={u.isActive ? 'Activa' : STATUS_LABEL[u.billing.status] || u.billing.status}
                        color={u.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {u.billing.currentPeriodEnd
                        ? new Date(u.billing.currentPeriodEnd).toLocaleDateString('es-AR')
                        : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {u.billing.usage.tournamentsCreated} torneo(s)
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Activar / extender">
                          <IconButton size="small" onClick={() => openGrantDialog(u)} sx={{ color: 'success.main' }}>
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cambiar plan">
                          <IconButton size="small" onClick={() => openChangePlan(u)} sx={{ color: '#4f49cd' }}>
                            <ChangePlanIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Ver historial">
                          <IconButton size="small" onClick={() => openHistory(u)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
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
      </SurfaceCard>

      {/* Activar / extender suscripción */}
      <Dialog open={!!grantTarget} onClose={() => setGrantTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Activar / extender suscripción</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Para <strong>{grantTarget?.username}</strong>. Si ya tiene una suscripción vigente, el nuevo
            período se suma después del vencimiento actual — no se pisa.
          </DialogContentText>
          <Stack spacing={2}>
            <TextField
              select
              label="Plan"
              value={grantForm.plan}
              onChange={(e) => updateGrantSelection({ plan: e.target.value as PlanId })}
              fullWidth
            >
              {PLAN_DEFINITIONS.filter((p) => p.id !== 'free').map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.label} (USD {p.priceUsdMonthly}/mes
                  {p.priceUsdYearly ? ` · USD ${p.priceUsdYearly}/año` : ''})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Intervalo cobrado"
              value={grantForm.interval}
              onChange={(e) => updateGrantSelection({ interval: e.target.value as 'monthly' | 'quarterly' | 'yearly' })}
              fullWidth
            >
              <MenuItem value="monthly">Mensual</MenuItem>
              <MenuItem value="quarterly">Trimestral</MenuItem>
              <MenuItem value="yearly">Anual</MenuItem>
            </TextField>
            <TextField
              label="Meses a acreditar"
              type="number"
              value={grantForm.months}
              onChange={(e) => setGrantForm({ ...grantForm, months: e.target.value })}
              fullWidth
              helperText="Se sugiere solo según el intervalo — ajustalo para regalar meses sueltos"
            />
            <TextField
              label="Monto cobrado en pesos (opcional, para el registro)"
              type="number"
              value={grantForm.amount}
              onChange={(e) => setGrantForm({ ...grantForm, amount: e.target.value })}
              fullWidth
              helperText={usdToArs ? 'Sugerido según el tipo de cambio vigente — podés ajustarlo' : undefined}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrantTarget(null)}>Cancelar</Button>
          <Button onClick={handleGrant} variant="contained" disabled={saving}>
            Activar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cambiar plan */}
      <Dialog open={!!changePlanTarget} onClose={() => setChangePlanTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Cambiar plan</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            El uso ya consumido este mes no se resetea. Bajar a Free cancela la suscripción vigente.
          </DialogContentText>
          <TextField
            select
            label="Nuevo plan"
            value={changePlanValue}
            onChange={(e) => setChangePlanValue(e.target.value as PlanId)}
            fullWidth
          >
            {PLAN_DEFINITIONS.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePlanTarget(null)}>Cancelar</Button>
          <Button onClick={handleChangePlan} variant="contained" disabled={saving}>
            Cambiar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Historial */}
      <Dialog open={!!historyTarget} onClose={() => setHistoryTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Historial de {historyTarget?.username}</DialogTitle>
        <DialogContent>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Períodos de suscripción</Typography>
              <List dense>
                {(history?.subscriptions ?? []).map((s) => (
                  <ListItem key={s._id} disableGutters>
                    <ListItemText
                      primary={`${PLAN_LABEL[s.plan]} — ${s.currentPeriodStart ? new Date(s.currentPeriodStart).toLocaleDateString('es-AR') : ''} a ${s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('es-AR') : ''}`}
                      secondary={`Registrado el ${new Date(s.createdAt).toLocaleDateString('es-AR')}`}
                    />
                  </ListItem>
                ))}
                {(history?.subscriptions ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">Sin períodos registrados.</Typography>
                )}
              </List>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Pagos</Typography>
              <List dense>
                {(history?.payments ?? []).map((p) => (
                  <ListItem key={p._id} disableGutters>
                    <ListItemText
                      primary={`${PLAN_LABEL[p.plan]} — $${p.amount ?? 0}`}
                      secondary={new Date(p.createdAt).toLocaleDateString('es-AR')}
                    />
                  </ListItem>
                ))}
                {(history?.payments ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">Sin pagos registrados.</Typography>
                )}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryTarget(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
