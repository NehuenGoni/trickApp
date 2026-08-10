import React from 'react';
import { Grid, Typography, Box, Chip, List, ListItem, ListItemIcon, ListItemText, Button, Stack } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate } from 'react-router-dom';
import SurfaceCard from '../../../components/SurfaceCard';
import Section from '../../../components/landing/Section';
import SectionHeading from '../../../components/landing/SectionHeading';
import Reveal from '../../../components/landing/Reveal';
import usePricing from '../../../hooks/usePricing';
import { PLAN_DEFINITIONS, formatArs } from '../../../config/plans';
import { PLAN_TEASERS } from '../content/planTeasers';

const PricingTeaserSection = () => {
  const navigate = useNavigate();
  // `usePricing` trae el precio real en ARS del backend. Mientras carga (o
  // si falla) mostramos el USD de referencia de `PLAN_DEFINITIONS` — nunca
  // un spinner, que en el medio de una landing rompe el layout.
  const { plans: pricedPlans } = usePricing();

  return (
    <Section id="planes" tone="night">
      <SectionHeading
        eyebrow="PLANES"
        title="Elegí según cuántas noches de truco hacés"
        subtitle="Empezás gratis con un torneo completo, con llave, pantalla en vivo y página pública, para probar todo antes de decidir. Se paga en pesos por MercadoPago."
      />

      <Grid container spacing={3} sx={{ mt: { xs: 2, md: 3 } }} justifyContent="center">
        {PLAN_DEFINITIONS.map((plan, i) => {
          const priced = pricedPlans.find((p) => p.id === plan.id);
          const ars = priced?.priceArsMonthly ?? null;

          return (
            <Grid item xs={12} sm={6} md={3} key={plan.id}>
              <Reveal delay={i * 60}>
                <SurfaceCard
                  elevation={0}
                  sx={{
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: plan.highlight ? '1px solid #FFD700' : '1px solid rgba(255,215,0,0.2)'
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

                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {plan.label}
                  </Typography>

                  <Box sx={{ my: 1.5 }}>
                    {plan.priceUsdMonthly === null ? (
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        Gratis
                      </Typography>
                    ) : (
                      <Stack direction="row" alignItems="baseline" spacing={0.5}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {ars !== null ? formatArs(ars) : `USD ${plan.priceUsdMonthly}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          / mes
                        </Typography>
                      </Stack>
                    )}
                  </Box>

                  <List dense sx={{ flexGrow: 1 }}>
                    {PLAN_TEASERS[plan.id].map((bullet) => (
                      <ListItem key={bullet} disableGutters sx={{ py: 0.4, alignItems: 'flex-start' }}>
                        <ListItemIcon sx={{ minWidth: 26, mt: '3px' }}>
                          <CheckIcon fontSize="small" sx={{ color: '#FFD700' }} />
                        </ListItemIcon>
                        <ListItemText primary={bullet} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>

                  <Button
                    fullWidth
                    variant={plan.highlight ? 'contained' : 'outlined'}
                    color={plan.highlight ? 'secondary' : 'gold'}
                    sx={{ mt: 2 }}
                    onClick={() => navigate(plan.id === 'free' ? '/register' : '/planes')}
                  >
                    {plan.id === 'free' ? 'Empezar gratis' : 'Ver este plan'}
                  </Button>
                </SurfaceCard>
              </Reveal>
            </Grid>
          );
        })}
      </Grid>

      <Reveal delay={200}>
        <Typography variant="body2" align="center" sx={{ mt: 4 }}>
          <Button color="gold" onClick={() => navigate('/planes')}>
            Ver el detalle de cada plan →
          </Button>
        </Typography>
        <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 1 }}>
          Los precios en dólares son de referencia; el cobro es en pesos, al tipo de cambio del día. También hay
          precio anual con descuento en Club y Pro.
        </Typography>
      </Reveal>
    </Section>
  );
};

export default PricingTeaserSection;
