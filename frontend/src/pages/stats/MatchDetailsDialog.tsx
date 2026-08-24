import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { UserMatch, UserMatchTeam } from '../../types/userStats';

interface MatchDetailsDialogProps {
  match: UserMatch | null;
  userId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Sin fetches: a diferencia de la versión anterior (que resolvía cada
 * jugador con un GET a /users/matchesNames/:id), `player.username` siempre
 * viene poblado en el match — tanto para invitados como para registrados
 * (ver teamToMatchTeam y advanceWinnerLoser en el backend) — así que se
 * renderiza directo.
 */
const TeamBlock: React.FC<{ title: string; team?: UserMatchTeam; highlight?: boolean }> = ({ title, team, highlight }) => {
  if (!team) return null;
  return (
    <>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', mt: 2 }}>
        {title}
      </Typography>
      <Box sx={{ mb: 2, p: 1.5, bgcolor: highlight ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
        {team.players.map((player, idx) => (
          <Typography key={idx} variant="body2" sx={{ py: 0.5 }}>
            • {player.username ?? 'Jugador'}
          </Typography>
        ))}
        <Typography variant="body2" sx={{ py: 0.5, fontWeight: 'bold', color: highlight ? '#D4AF37' : undefined }}>
          Puntuación: {team.score}
        </Typography>
      </Box>
    </>
  );
};

const MatchDetailsDialog: React.FC<MatchDetailsDialogProps> = ({ match, userId, open, onClose }) => {
  const teams = match?.teams ?? [];
  const myTeamIndex = teams.findIndex((t) => t.players.some((p) => p.playerId === userId));
  const myTeam = myTeamIndex !== -1 ? teams[myTeamIndex] : undefined;
  const otherTeam = myTeamIndex !== -1 ? teams[myTeamIndex === 0 ? 1 : 0] : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        variant="h5"
        sx={{ display: 'flex', fontWeight: 'bold', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}
      >
        Detalles del Partido
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {match && (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                Información
              </Typography>
              <Typography variant="body2">
                <strong>Fecha:</strong>{' '}
                {new Date(match.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </Typography>
              <Typography variant="body2">
                <strong>Tipo:</strong> {match.type === 'friendly' ? 'Amistoso' : 'Torneo'}
              </Typography>
              <Typography variant="body2">
                <strong>Estado:</strong> {match.status}
              </Typography>
            </Box>

            <TeamBlock title="Tu Equipo" team={myTeam} highlight />
            <TeamBlock title="Equipo Contrario" team={otherTeam} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" variant="contained">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MatchDetailsDialog;
