import React, { useEffect, useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import {
  People as PeopleIcon,
  EmojiEvents as TrophyIcon,
  SportsEsports as MatchIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import API_ROUTES, { apiRequest } from '../../config/api';
import TournamentLogo from '../../components/TournamentLogo';
import { TournamentLogoMeta } from '../../types/tournament';

interface AdminStats {
  users: { total: number; newLast30Days: number };
  tournaments: { total: number; upcoming: number; inProgress: number; completed: number };
  matches: { total: number; inProgress: number };
  topPlayers: Array<{ _id: string; username: string; totalPoints: number }>;
  recentTournaments: Array<{
    _id: string;
    name: string;
    status: 'upcoming' | 'in_progress' | 'completed';
    startDate: string;
    logo?: TournamentLogoMeta | null;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Inscripciones abiertas',
  in_progress: 'En curso',
  completed: 'Finalizado'
};

const MetricCard = ({
  icon,
  label,
  value,
  hint
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}) => (
  <Paper elevation={3} sx={{ p: 2.5, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: '#D4AF37' }}>
      {icon}
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
    <Typography variant="h4" fontWeight={700}>
      {value}
    </Typography>
    {hint && (
      <Typography variant="caption" color="text.secondary">
        {hint}
      </Typography>
    )}
  </Paper>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest(API_ROUTES.ADMIN.STATS)
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar las métricas'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout
      title="Panel de administración"
      subtitle="Estado general de la aplicación."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : stats ? (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<PeopleIcon />}
                label="Usuarios registrados"
                value={stats.users.total}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<PersonAddIcon />}
                label="Altas (30 días)"
                value={stats.users.newLast30Days}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<TrophyIcon />}
                label="Torneos"
                value={stats.tournaments.total}
                hint={`${stats.tournaments.inProgress} en curso · ${stats.tournaments.upcoming} abiertos`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<MatchIcon />}
                label="Partidos"
                value={stats.matches.total}
                hint={`${stats.matches.inProgress} en curso`}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 2.5, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Top jugadores
                </Typography>
                <Divider sx={{ mb: 1 }} />
                {stats.topPlayers.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    Todavía no hay puntos cargados.
                  </Typography>
                ) : (
                  <List dense>
                    {stats.topPlayers.map((player, index) => (
                      <ListItem key={player._id} disableGutters>
                        <ListItemText
                          primary={`${index + 1}. ${player.username}`}
                          secondary={`${player.totalPoints} puntos`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 2.5, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Torneos recientes
                </Typography>
                <Divider sx={{ mb: 1 }} />
                {stats.recentTournaments.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No hay torneos creados.
                  </Typography>
                ) : (
                  <List dense>
                    {stats.recentTournaments.map((tournament) => (
                      <ListItem
                        key={tournament._id}
                        disableGutters
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/admin/tournaments')}
                        secondaryAction={
                          <Chip size="small" label={STATUS_LABEL[tournament.status]} />
                        }
                      >
                        <ListItemAvatar sx={{ minWidth: 44 }}>
                          <TournamentLogo tournament={tournament} size={32} />
                        </ListItemAvatar>
                        <ListItemText
                          primary={tournament.name}
                          secondary={new Date(tournament.startDate).toLocaleDateString('es-AR')}
                          sx={{ pr: 12 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
          </Grid>
        </>
      ) : null}
    </AdminLayout>
  );
};

export default AdminDashboard;
