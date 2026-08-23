import React from 'react';
import { Alert, AlertColor, Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SurfaceCard from './SurfaceCard';

interface PlanLimitAlertProps {
  message: string;
  /**
   * Solo se muestra el botón "Ver planes" cuando esto es `true`. Un límite de
   * liga puede tocarlo alguien que no es el dueño del plan (un jugador
   * auto-inscribiéndose, un organizador): a esa persona ofrecerle un upgrade
   * que no puede pagar no tiene sentido.
   */
  canUpgrade: boolean;
  severity?: AlertColor;
  sx?: object;
}

/**
 * Aviso reutilizable de "límite de plan alcanzado" + CTA a `/planes`. Antes
 * había tres copias inline casi idénticas de este patrón (CreateTournament,
 * LeagueDetails, y esta es la cuarta que iba a sumar el cupo de jugadores).
 * El mensaje siempre lo arma el backend (sabe el plan, el uso y quién pidió
 * la acción) — este componente solo lo muestra.
 */
export const PlanLimitAlert: React.FC<PlanLimitAlertProps> = ({ message, canUpgrade, severity = 'warning', sx }) => {
  const navigate = useNavigate();
  return (
    <Alert
      severity={severity}
      sx={sx}
      action={
        canUpgrade ? (
          <Button size="small" onClick={() => navigate('/planes', { state: { message } })}>
            Ver planes
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
};

interface PlanLimitPageProps {
  title: string;
  message: string;
  canUpgrade?: boolean;
}

/**
 * Misma idea que `PlanLimitAlert` pero a página completa, para cuando el
 * límite bloquea la pantalla entera (ej. crear un torneo sin cupo) en vez de
 * una acción puntual dentro de una pantalla que sigue siendo usable.
 */
export const PlanLimitPage: React.FC<PlanLimitPageProps> = ({ title, message, canUpgrade = true }) => {
  const navigate = useNavigate();
  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <SurfaceCard sx={{ textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom sx={{ color: '#FFD700', fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>
        {canUpgrade && (
          <Box>
            <Button variant="contained" onClick={() => navigate('/planes', { state: { message } })}>
              Ver planes
            </Button>
          </Box>
        )}
      </SurfaceCard>
    </Container>
  );
};

export default PlanLimitAlert;
