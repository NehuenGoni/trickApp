import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  TextField
} from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import useCurrentUser from '../../hooks/useCurrentUser';
import useBilling, { clearBillingCache } from '../../hooks/useBilling';
import usePricing from '../../hooks/usePricing';
import { PricingPlan, formatArs } from '../../config/plans';
import API_ROUTES, { apiRequest, CheckoutUnavailableError } from '../../config/api';

type BillingCycle = 'monthly' | 'yearly';

const formatLimit = (value: number | null, singular: string, plural: string): string => {
  if (value === null) return `${plural} ilimitados`;
  if (value === 0) return `Sin ${plural}`;
  return `${value} ${value === 1 ? singular : plural}`;
};

const planFeatures = (plan: PricingPlan): string[] => {
  if (plan.id === 'free') {
    return ['Partidos sueltos y contador de truco, gratis siempre', '1 torneo de prueba, de por vida', 'Tabla pública compartible de ese torneo'];
  }
  const { limits } = plan;
  const features = [
    `${formatLimit(limits.tournamentsPerMonth, 'torneo', 'torneos')} por mes`,
    `Hasta ${formatLimit(limits.maxLeagues, 'liga', 'ligas')}`,
    `${formatLimit(limits.maxMembers, 'jugador', 'jugadores')} por liga`,
    limits.maxOrganizers === 0 ? 'Sin organizadores adicionales' : `${formatLimit(limits.maxOrganizers, 'organizador', 'organizadores')} además de vos`,
    'Tabla pública compartible'
  ];
  if (plan.id === 'club' || plan.id === 'pro') {
    features.push('Branding del logo de los torneos en la pantalla en vivo', 'Historial y exportación de temporadas');
  }
  if (plan.id === 'pro') {
    features.push('Espacio de sponsor en la pantalla en vivo');
  }
  return features;
};

/** Precio en ARS del plan para el ciclo elegido — ya calculado por el backend. */
const arsPriceFor = (plan: PricingPlan, cycle: BillingCycle): number | null =>
  cycle === 'monthly' ? plan.priceArsMonthly : plan.priceArsYearly;

const usdPriceFor = (plan: PricingPlan, cycle: BillingCycle): number | null =>
  cycle === 'monthly' ? plan.priceUsdMonthly : (plan.priceUsdYearly ?? (plan.priceUsdMonthly !== null ? plan.priceUsdMonthly * 12 : null));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Plans = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { billing } = useBilling();
  const { plans, mercadoPagoEnabled, loading: pricingLoading } = usePricing();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [contactTarget, setContactTarget] = useState<PricingPlan | null>(null);
  const [emailTarget, setEmailTarget] = useState<PricingPlan | null>(null);
  const [payerEmail, setPayerEmail] = useState('');
  const [payerEmailError, setPayerEmailError] = useState('');
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  const handleChoose = (plan: PricingPlan) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!mercadoPagoEnabled) {
      setContactTarget(plan);
      return;
    }

    // La cuenta de MercadoPago con la que paga puede no ser la misma con la
    // que se registró en TrickApp — se lo confirmamos antes de redirigir,
    // porque MP exige que coincida exactamente con la que usa para pagar.
    setPayerEmailError('');
    setPayerEmail(user.email ?? '');
    setEmailTarget(plan);
  };

  const startCheckout = async () => {
    if (!emailTarget) return;
    if (!EMAIL_REGEX.test(payerEmail.trim())) {
      setPayerEmailError('Ingresá un email válido');
      return;
    }

    const plan = emailTarget;
    setEmailTarget(null);
    setCheckoutError('');
    setCheckingOut(plan.id);
    try {
      const res = await apiRequest(API_ROUTES.BILLING.CHECKOUT, {
        method: 'POST',
        body: JSON.stringify({
          plan: plan.id,
          interval: cycle === 'monthly' ? 'monthly' : 'yearly',
          payerEmail: payerEmail.trim()
        })
      });
      clearBillingCache();
      window.location.href = res.initPoint;
    } catch (err) {
      if (err instanceof CheckoutUnavailableError) {
        setContactTarget(plan);
      } else {
        setCheckoutError(err instanceof Error ? err.message : 'No pudimos iniciar el pago. Probá de nuevo en un rato.');
      }
      setCheckingOut(null);
    }
  };

  const contactArs = contactTarget ? arsPriceFor(contactTarget, cycle) : null;

  return (
    <Box>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Planes
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Elegí el plan según cuántos torneos hacés por mes. El primero es gratis para que pruebes la app completa.
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={cycle}
            onChange={(_, value) => value && setCycle(value)}
          >
            <ToggleButton value="monthly">Mensual</ToggleButton>
            <ToggleButton value="yearly">Anual</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {checkoutError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setCheckoutError('')}>
            {checkoutError}
          </Alert>
        )}

        {pricingLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3} justifyContent="center">
            {plans.map((plan) => {
              const isCurrent = billing?.plan === plan.id;
              const ars = arsPriceFor(plan, cycle);
              const usd = usdPriceFor(plan, cycle);
              const savingsUsd =
                cycle === 'yearly' && plan.priceUsdMonthly !== null && plan.priceUsdYearly !== null
                  ? plan.priceUsdMonthly * 12 - plan.priceUsdYearly
                  : 0;
              const savingsMonths =
                savingsUsd > 0 && plan.priceUsdMonthly ? Math.round(savingsUsd / plan.priceUsdMonthly) : 0;

              return (
                <Grid item xs={12} sm={6} md={3} key={plan.id}>
                  <Card
                    elevation={plan.highlight ? 6 : 2}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      border: plan.highlight ? 2 : 0,
                      borderColor: 'secondary.main'
                    }}
                  >
                    {plan.highlight && (
                      <Chip
                        label="Más elegido"
                        color="secondary"
                        size="small"
                        sx={{ position: 'absolute', top: 12, right: 12 }}
                      />
                    )}
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" component="h2">
                        {plan.label}
                      </Typography>
                      <Box sx={{ my: 2 }}>
                        {usd === null ? (
                          <Typography variant="h4">Gratis</Typography>
                        ) : ars !== null ? (
                          <>
                            <Typography variant="h4" component="span">
                              {formatArs(ars)}
                            </Typography>
                            <Typography variant="body2" component="span" color="text.secondary">
                              {' '}
                              / {cycle === 'monthly' ? 'mes' : 'año'}
                            </Typography>
                            <Typography variant="caption" component="p" color="text.secondary">
                              USD {usd}
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Typography variant="h4" component="span">
                              USD {usd}
                            </Typography>
                            <Typography variant="body2" component="span" color="text.secondary">
                              {' '}
                              / {cycle === 'monthly' ? 'mes' : 'año'}
                            </Typography>
                          </>
                        )}
                        {savingsMonths > 0 && (
                          <Chip
                            label={`Ahorrás USD ${savingsUsd} · ${savingsMonths} ${savingsMonths === 1 ? 'mes' : 'meses'}`}
                            color="success"
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Box>

                      <List dense sx={{ flexGrow: 1 }}>
                        {planFeatures(plan).map((feature) => (
                          <ListItem key={feature} disableGutters sx={{ py: 0.25 }}>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <CheckIcon fontSize="small" color="success" />
                            </ListItemIcon>
                            <ListItemText primary={feature} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItem>
                        ))}
                      </List>

                      <Button
                        fullWidth
                        variant={isCurrent ? 'outlined' : plan.highlight ? 'contained' : 'outlined'}
                        color={plan.highlight ? 'secondary' : 'primary'}
                        disabled={isCurrent || checkingOut === plan.id}
                        sx={{ mt: 2 }}
                        onClick={() => (plan.id === 'free' ? navigate('/dashboard') : handleChoose(plan))}
                      >
                        {checkingOut === plan.id ? (
                          <CircularProgress size={22} color="inherit" />
                        ) : isCurrent ? (
                          'Tu plan actual'
                        ) : plan.id === 'free' ? (
                          'Empezar gratis'
                        ) : (
                          'Quiero este plan'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 3 }}>
          Los precios en pesos son al tipo de cambio vigente y se cobran en pesos.
        </Typography>
      </Container>

      <Dialog open={!!contactTarget} onClose={() => setContactTarget(null)}>
        <DialogTitle>Activar el plan {contactTarget?.label}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Por ahora la activación es manual: coordiná el pago con quien administra TrickApp y te activamos
            el plan {contactTarget?.label} ({cycle === 'monthly' ? 'mensual' : 'anual'}
            {contactArs !== null ? `, ${formatArs(contactArs)}` : ''}) en minutos.
          </DialogContentText>
          <Alert severity="info" sx={{ mt: 2 }}>
            Contactate por el medio habitual (WhatsApp, email) para coordinar la activación.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactTarget(null)}>Entendido</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!emailTarget} onClose={() => setEmailTarget(null)}>
        <DialogTitle>¿Con qué cuenta de MercadoPago vas a pagar?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Puede ser distinta a la que usás para entrar a TrickApp. Necesitamos el email exacto de tu cuenta de
            MercadoPago para armar la suscripción del plan {emailTarget?.label}.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            type="email"
            label="Email de tu cuenta de MercadoPago"
            value={payerEmail}
            onChange={(e) => {
              setPayerEmail(e.target.value);
              if (payerEmailError) setPayerEmailError('');
            }}
            error={!!payerEmailError}
            helperText={payerEmailError}
            sx={{ mt: 2 }}
            onKeyDown={(e) => e.key === 'Enter' && startCheckout()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailTarget(null)}>Cancelar</Button>
          <Button variant="contained" onClick={startCheckout}>
            Continuar a MercadoPago
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Plans;
