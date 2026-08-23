import React from 'react';
import { Grid, Box, Typography, Divider } from '@mui/material';
import {
  SportsEsports as MatchIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingUpIcon,
  LocalFireDepartment as StreakIcon
} from '@mui/icons-material';
import SurfaceCard from '../../components/SurfaceCard';
import MetricCard from '../../components/MetricCard';
import FormStrip from '../../components/stats/FormStrip';
import ActivityChart from '../../components/stats/ActivityChart';
import WinRateDonut from '../../components/stats/WinRateDonut';
import { UserStatsSummary } from '../../types/userStats';

interface OverviewTabProps {
  stats: UserStatsSummary;
}

const streakLabel = (streak: UserStatsSummary['overview']['currentStreak']): string => {
  if (streak.type === 'none') return 'Sin racha';
  return `${streak.count} ${streak.type === 'win' ? (streak.count === 1 ? 'victoria' : 'victorias') : streak.count === 1 ? 'derrota' : 'derrotas'} seguidas`;
};

const OverviewTab: React.FC<OverviewTabProps> = ({ stats }) => {
  const { overview, tournaments } = stats;

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <MetricCard icon={<MatchIcon />} label="Partidos Jugados" value={overview.played} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard icon={<TrophyIcon />} label="Victorias" value={overview.wins} valueColor="#4CAF50" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard icon={<TrendingUpIcon />} label="% Victorias" value={`${Math.round(overview.winRate * 100)}%`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            icon={<StreakIcon />}
            label="Racha Actual"
            value={overview.currentStreak.count || '—'}
            hint={streakLabel(overview.currentStreak)}
            valueColor={
              overview.currentStreak.type === 'win' ? '#4CAF50' : overview.currentStreak.type === 'loss' ? '#F44336' : undefined
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <SurfaceCard title="Rendimiento" sx={{ p: 2.5, height: '100%' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={5}>
                <WinRateDonut wins={overview.wins} losses={overview.losses} />
              </Grid>
              <Grid item xs={12} sm={7}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">Puntos a favor</Typography>
                  <Typography fontWeight={700}>{overview.pointsFor}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">Puntos en contra</Typography>
                  <Typography fontWeight={700}>{overview.pointsAgainst}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">Diferencia</Typography>
                  <Typography fontWeight={700} sx={{ color: overview.pointsDiff >= 0 ? '#4CAF50' : '#F44336' }}>
                    {overview.pointsDiff >= 0 ? '+' : ''}
                    {overview.pointsDiff}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">Promedio por partido</Typography>
                  <Typography fontWeight={700}>
                    {overview.avgPointsFor} - {overview.avgPointsAgainst}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">Mejor racha ganadora</Typography>
                  <Typography fontWeight={700} sx={{ color: '#4CAF50' }}>
                    {overview.bestWinStreak}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">Peor racha perdedora</Typography>
                  <Typography fontWeight={700} sx={{ color: '#F44336' }}>
                    {overview.worstLossStreak}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SurfaceCard title="Trayectoria en Torneos" sx={{ p: 2.5, height: '100%' }}>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Typography color="text.secondary" variant="body2">
                  Torneos jugados
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {tournaments.tournamentsPlayed}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="text.secondary" variant="body2">
                  Torneos ganados
                </Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#FFD700' }}>
                  {tournaments.wins}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="text.secondary" variant="body2">
                  Podios
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {tournaments.podiums}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="text.secondary" variant="body2">
                  Mejor posición
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {tournaments.bestPosition ?? '—'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  Ranking global
                </Typography>
                <Typography variant="h6" fontWeight={700} sx={{ color: '#FFD700' }}>
                  {tournaments.globalRank ? `#${tournaments.globalRank} de ${tournaments.globalRankOutOf}` : '—'}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({tournaments.totalPoints} pts)
                  </Typography>
                </Typography>
              </Grid>
            </Grid>
          </SurfaceCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={5}>
          <SurfaceCard title="Amistosos vs Torneos" sx={{ p: 2.5, height: '100%' }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Amistosos
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {overview.byType.friendly.wins}-{overview.byType.friendly.losses}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(overview.byType.friendly.winRate * 100)}% victorias
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Torneos
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {overview.byType.tournament.wins}-{overview.byType.tournament.losses}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(overview.byType.tournament.winRate * 100)}% victorias
                </Typography>
              </Grid>
            </Grid>
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={7}>
          <SurfaceCard title="Actividad (últimos 12 meses)" sx={{ p: 2.5, height: '100%' }}>
            <ActivityChart months={stats.activity} />
          </SurfaceCard>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <SurfaceCard title="Forma Reciente" sx={{ p: 2.5 }}>
          <FormStrip entries={stats.recentForm} />
        </SurfaceCard>
      </Box>

      {overview.discardedMatches > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          {overview.discardedMatches} partido(s) con datos incompletos no se contaron en estas estadísticas.
        </Typography>
      )}
    </Box>
  );
};

export default OverviewTab;
