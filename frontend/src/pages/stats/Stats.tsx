import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Tabs, Tab, Button } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import { useUserStats } from '../../hooks/useUserStats';
import OverviewTab from './OverviewTab';
import PeersTab from './PeersTab';
import MatchesTab from './MatchesTab';

type StatsTab = 'overview' | 'peers' | 'matches';

const Stats = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [minPlayed, setMinPlayed] = useState<number | undefined>(undefined);

  const rawTab = searchParams.get('tab');
  const activeTab: StatsTab = rawTab === 'peers' || rawTab === 'matches' ? rawTab : 'overview';

  const handleTabChange = (_: React.SyntheticEvent, value: StatsTab) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'overview') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next);
  };

  // 'me': el backend resuelve al usuario del token, `stats.userId` trae el id
  // real una vez resuelto — no hace falta pedirlo aparte con useCurrentUser.
  const { stats, loading, error, refresh } = useUserStats('me', minPlayed);

  const handleShowAllPeers = () => setMinPlayed(1);

  useEffect(() => {
    if (minPlayed !== undefined) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPlayed]);

  return (
    <Box>
      <NavBar />
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ textAlign: 'center', mb: 2, color: '#FFD700', fontWeight: 700 }}>
          Mis Estadísticas
        </Typography>

        {loading && !stats ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error" gutterBottom>
              {error}
            </Typography>
            <Button variant="outlined" onClick={refresh}>
              Reintentar
            </Button>
          </Box>
        ) : !stats ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              centered
              sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Resumen" value="overview" />
              <Tab label="Compañeros y Rivales" value="peers" />
              <Tab label="Partidos" value="matches" />
            </Tabs>

            {activeTab === 'overview' && <OverviewTab stats={stats} />}
            {activeTab === 'peers' && <PeersTab stats={stats} onShowAll={handleShowAllPeers} loading={loading} />}
            {activeTab === 'matches' && <MatchesTab userId={stats.userId} />}
          </>
        )}
      </Box>
    </Box>
  );
};

export default Stats;
