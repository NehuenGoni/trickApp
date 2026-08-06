import React, { useEffect, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Chip,
  Button,
  Alert,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useBilling from '../../hooks/useBilling';
import useBillingHistory from '../../hooks/useBillingHistory';
import usePricing from '../../hooks/usePricing';
import API_ROUTES, { apiRequest } from '../../config/api';
import { formatArs } from '../../config/plans';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  basico: 'Básico',
  club: 'Club',
  pro: 'Pro'
};

const INTERVAL_LABELS: Record<string, string> = {
  monthly: 'mensual',
  quarterly: 'trimestral',
  yearly: 'anual'
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  approved: { label: 'Aprobado', color: 'success' },
  pending: { label: 'Pendiente', color: 'warning' },
  rejected: { label: 'Rechazado', color: 'error' },
  refunded: { label: 'Reembolsado', color: 'default' }
};

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const daysUntil = (value: string | null): number | null => {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const PlanTab = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { billing, loading: billingLoading, error: billingError, refresh } = useBilling();
  const { history, loading: historyLoading, refresh: refreshHistory } = useBillingHistory();
  const { plans } = usePricing();

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Vuelta desde MercadoPago: no confiamos en que el webhook ya haya llegado
  // (puede demorar, o directamente no llegar) — pedimos al backend que
  // reconcilie contra el estado real de MP antes de refrescar.
  useEffect(() => {
    // MP le agrega sus propios parámetros (p.ej. `preapproval_id`) al final del
    // `back_url` con un `?` en vez de `&` cuando este ya tenía query string
    // propio — el valor de `mp` puede terminar siendo "return?preapproval_id=..."
    // en vez de "return" a secas, por eso `startsWith` en vez de igualdad exacta.
    if (searchParams.get('mp')?.startsWith('return')) {
      setConfirming(true);
      apiRequest(API_ROUTES.BILLING.SYNC, { method: 'POST' })
        .catch(() => {
          // Si la reconciliación falla igual refrescamos: el webhook puede haber
          // llegado por su cuenta mientras tanto.
        })
        .then(() => Promise.all([refresh(), refreshHistory()]))
        .finally(() => {
          const next = new URLSearchParams(searchParams);
          next.delete('mp');
          setSearchParams(next, { replace: true });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async () => {
    setCanceling(true);
    setCancelError('');
    try {
      await apiRequest(API_ROUTES.BILLING.CANCEL, { method: 'POST' });
      setConfirmCancel(false);
      await refresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'No pudimos cancelar la renovación');
    } finally {
      setCanceling(false);
    }
  };

  if (billingLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (billingError || !billing) {
    return <Alert severity="error">{billingError || 'No pudimos cargar tu plan'}</Alert>;
  }

  const planLabel = plans.find((p) => p.id === billing.plan)?.label ?? PLAN_LABELS[billing.plan] ?? billing.plan;
  const remaining = daysUntil(billing.currentPeriodEnd);
  const canCancelAutoRenew = billing.autoRenew && billing.paymentProvider === 'mercadopago';

  let statusChip: { label: string; color: 'success' | 'warning' | 'error' | 'default' };
  if (billing.plan === 'free') {
    statusChip = { label: 'Gratis', color: 'default' };
  } else if (billing.isActive) {
    statusChip = billing.autoRenew
      ? { label: 'Activo · renovación automática', color: 'success' }
      : { label: 'Activo · no se renueva', color: 'warning' };
  } else if (billing.status === 'past_due') {
    statusChip = { label: 'Pago pendiente', color: 'warning' };
  } else {
    statusChip = { label: 'Vencido', color: 'error' };
  }

  return (
    <Box>
      {confirming && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={() => setConfirming(false)}>
          Estamos confirmando tu pago con MercadoPago. Puede demorar unos segundos en reflejarse acá.
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Typography variant="h6">Plan {planLabel}</Typography>
          <Chip label={statusChip.label} color={statusChip.color} size="small" />
        </Box>

        {billing.plan !== 'free' && (
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Contratado desde</Typography>
              <Typography variant="body1">{formatDate(billing.currentPeriodStart)}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {billing.autoRenew ? 'Próxima renovación' : 'Vence'}
              </Typography>
              <Typography variant="body1">
                {formatDate(billing.currentPeriodEnd)}
                {remaining !== null && remaining >= 0 && ` (${remaining === 0 ? 'hoy' : `en ${remaining} día${remaining === 1 ? '' : 's'}`})`}
              </Typography>
            </Box>
            {billing.interval && (
              <Box>
                <Typography variant="body2" color="text.secondary">Ciclo</Typography>
                <Typography variant="body1">{INTERVAL_LABELS[billing.interval] ?? billing.interval}</Typography>
              </Box>
            )}
          </Box>
        )}

        {!billing.isActive && billing.plan !== 'free' && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Tu suscripción venció. Podés seguir gestionando lo que ya tenés en curso, pero para crear torneos o
            ligas nuevas necesitás reactivar el plan.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 3 }}>
          <Button variant="contained" onClick={() => navigate('/planes')}>
            Cambiar de plan
          </Button>
          {canCancelAutoRenew && (
            <Button variant="outlined" color="error" onClick={() => setConfirmCancel(true)}>
              Cancelar renovación automática
            </Button>
          )}
        </Box>
      </Paper>

      <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Uso de este período</Typography>

        {billing.plan === 'free' ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Torneo de prueba (de por vida)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, billing.usage.tournamentsTotal * 100)}
              color={billing.usage.tournamentsTotal >= 1 ? 'warning' : 'primary'}
              sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {billing.usage.tournamentsTotal} de 1 usado
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Torneos este mes
              </Typography>
              {billing.limits.tournamentsPerMonth === null ? (
                <Typography variant="body2">{billing.usage.tournamentsCreated} creados · sin límite</Typography>
              ) : (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (billing.usage.tournamentsCreated / billing.limits.tournamentsPerMonth) * 100)}
                    color={billing.usage.tournamentsCreated > billing.limits.tournamentsPerMonth ? 'error' : 'primary'}
                    sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {billing.usage.tournamentsCreated} de {billing.limits.tournamentsPerMonth}
                  </Typography>
                </>
              )}
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Ligas
              </Typography>
              {billing.limits.maxLeagues === 0 ? (
                <Typography variant="body2">Tu plan no incluye ligas</Typography>
              ) : (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (billing.usage.leaguesUsed / billing.limits.maxLeagues) * 100)}
                    color={billing.usage.leaguesUsed > billing.limits.maxLeagues ? 'error' : 'primary'}
                    sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {billing.usage.leaguesUsed} de {billing.limits.maxLeagues}
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>Historial de pagos</Typography>
        {historyLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : !history || history.payments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Todavía no registrás pagos.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Período</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.payments.map((payment) => {
                  const status = PAYMENT_STATUS_LABELS[payment.status] ?? { label: payment.status, color: 'default' as const };
                  return (
                    <TableRow key={payment._id}>
                      <TableCell>{formatDate(payment.createdAt)}</TableCell>
                      <TableCell>{PLAN_LABELS[payment.plan] ?? payment.plan}</TableCell>
                      <TableCell>
                        {payment.periodStart && payment.periodEnd
                          ? `${formatDate(payment.periodStart)} — ${formatDate(payment.periodEnd)}`
                          : '—'}
                      </TableCell>
                      <TableCell align="right">{formatArs(payment.amount)}</TableCell>
                      <TableCell>
                        <Chip label={status.label} color={status.color} size="small" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Dialog open={confirmCancel} onClose={() => !canceling && setConfirmCancel(false)}>
        <DialogTitle>Cancelar renovación automática</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vas a dejar de pagar el plan {planLabel} automáticamente. Seguís teniendo acceso hasta el{' '}
            {formatDate(billing.currentPeriodEnd)}; después, tu cuenta pasa a Free.
          </DialogContentText>
          {cancelError && <Alert severity="error" sx={{ mt: 2 }}>{cancelError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(false)} disabled={canceling}>
            Volver
          </Button>
          <Button onClick={handleCancel} color="error" disabled={canceling}>
            {canceling ? <CircularProgress size={20} /> : 'Sí, cancelar renovación'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlanTab;
