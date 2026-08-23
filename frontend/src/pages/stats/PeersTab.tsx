import React, { useState } from 'react';
import { Grid, Box, Typography, Button } from '@mui/material';
import { Handshake as HandshakeIcon, Whatshot as NemesisIcon, Star as VictimIcon } from '@mui/icons-material';
import SurfaceCard from '../../components/SurfaceCard';
import MetricCard from '../../components/MetricCard';
import PeerTable from '../../components/stats/PeerTable';
import { UserStatsSummary } from '../../types/userStats';

interface PeersTabProps {
  stats: UserStatsSummary;
  /** Cambia minPlayed a 1 y refetchea (toggle "mostrar todos"). */
  onShowAll: () => void;
  loading: boolean;
}

const PeersTab: React.FC<PeersTabProps> = ({ stats, onShowAll, loading }) => {
  const [showingAll, setShowingAll] = useState(stats.meta.minPlayedTogether <= 1);
  const belowThreshold = stats.meta.partnersBelowThreshold + stats.meta.rivalsBelowThreshold;

  const handleShowAll = () => {
    setShowingAll(true);
    onShowAll();
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <MetricCard
            icon={<HandshakeIcon />}
            label="Mejor Compañero"
            value={stats.bestPartner?.displayName ?? '—'}
            hint={stats.bestPartner ? `${Math.round(stats.bestPartner.winRate * 100)}% en ${stats.bestPartner.played} partidos` : undefined}
            valueColor="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard
            icon={<NemesisIcon />}
            label="Némesis"
            value={stats.nemesis?.displayName ?? '—'}
            hint={stats.nemesis ? `${Math.round(stats.nemesis.winRate * 100)}% en ${stats.nemesis.played} partidos` : undefined}
            valueColor="#F44336"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard
            icon={<VictimIcon />}
            label="Víctima Favorita"
            value={stats.favouriteVictim?.displayName ?? '—'}
            hint={
              stats.favouriteVictim
                ? `${Math.round(stats.favouriteVictim.winRate * 100)}% en ${stats.favouriteVictim.played} partidos`
                : undefined
            }
            valueColor="#FFD700"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <SurfaceCard title="Compañeros" sx={{ p: 2.5 }}>
            <PeerTable
              rows={stats.partners}
              emptyMessage="Todavía no tenés suficientes partidos con ningún compañero."
            />
          </SurfaceCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SurfaceCard title="Rivales" sx={{ p: 2.5 }}>
            <PeerTable rows={stats.rivals} emptyMessage="Todavía no tenés suficientes partidos contra ningún rival." />
          </SurfaceCard>
        </Grid>
      </Grid>

      {!showingAll && belowThreshold > 0 && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {belowThreshold} jugador(es) con menos de {stats.meta.minPlayedTogether} partidos juntos no se muestran.
          </Typography>
          <Button size="small" variant="outlined" onClick={handleShowAll} disabled={loading}>
            Mostrar todos
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default PeersTab;
