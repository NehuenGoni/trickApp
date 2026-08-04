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
  Alert
} from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import useCurrentUser from '../../hooks/useCurrentUser';
import useBilling from '../../hooks/useBilling';
import { PLAN_DEFINITIONS, PlanDefinition } from '../../config/plans';

const formatLimit = (value: number | null, singular: string, plural: string): string => {
  if (value === null) return `${plural} ilimitados`;
  if (value === 0) return `Sin ${plural}`;
  return `${value} ${value === 1 ? singular : plural}`;
};

const planFeatures = (plan: PlanDefinition): string[] => {
  if (plan.id === 'free') {
    return ['Partidos sueltos y contador de truco, gratis siempre', '1 torneo de prueba, de por vida', 'Tabla pública compartible de ese torneo'];
  }
  const features = [
    `${formatLimit(plan.tournamentsPerMonth, 'torneo', 'torneos')} por mes`,
    `Hasta ${formatLimit(plan.maxLeagues, 'liga', 'ligas')}`,
    `${formatLimit(plan.maxMembers, 'jugador', 'jugadores')} por liga`,
    plan.maxOrganizers === 0 ? 'Sin organizadores adicionales' : `${formatLimit(plan.maxOrganizers, 'organizador', 'organizadores')} además de vos`,
    'Tabla pública compartible'
  ];
  if (plan.id === 'club' || plan.id === 'pro') {
    features.push('Branding del bar en la pantalla en vivo', 'Historial y exportación de temporadas');
  }
  if (plan.id === 'pro') {
    features.push('Espacio de sponsor en la pantalla en vivo');
  }
  return features;
};

const Plans = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { billing } = useBilling();
  const [contactTarget, setContactTarget] = useState<PlanDefinition | null>(null);

  const handleChoose = (plan: PlanDefinition) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setContactTarget(plan);
  };

  return (
    <Box>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Planes
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
          Elegí el plan según cuántos torneos hacés por mes. El primero es gratis para que pruebes la app completa.
        </Typography>

        <Grid container spacing={3} justifyContent="center">
          {PLAN_DEFINITIONS.map((plan) => {
            const isCurrent = billing?.plan === plan.id;
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
                      {plan.priceUsd === null ? (
                        <Typography variant="h4">Gratis</Typography>
                      ) : (
                        <>
                          <Typography variant="h4" component="span">
                            USD {plan.priceUsd}
                          </Typography>
                          <Typography variant="body2" component="span" color="text.secondary">
                            {' '}
                            / mes
                          </Typography>
                        </>
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
                      disabled={isCurrent}
                      sx={{ mt: 2 }}
                      onClick={() => (plan.id === 'free' ? navigate('/dashboard') : handleChoose(plan))}
                    >
                      {isCurrent ? 'Tu plan actual' : plan.id === 'free' ? 'Empezar gratis' : 'Quiero este plan'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      <Dialog open={!!contactTarget} onClose={() => setContactTarget(null)}>
        <DialogTitle>Activar el plan {contactTarget?.label}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Por ahora la activación es manual: coordiná el pago con quien administra TrickApp y te activamos
            el plan {contactTarget?.label} en minutos.
          </DialogContentText>
          <Alert severity="info" sx={{ mt: 2 }}>
            Contactate por el medio habitual (WhatsApp, email) para coordinar la activación.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactTarget(null)}>Entendido</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Plans;
