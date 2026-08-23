import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography, Chip, CircularProgress, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LandingNav from '../../components/landing/LandingNav';
import LandingFooter from '../../components/landing/LandingFooter';
import SurfaceCard from '../../components/SurfaceCard';
import Section from '../../components/landing/Section';
import SectionHeading from '../../components/landing/SectionHeading';
import Reveal from '../../components/landing/Reveal';
import API_ROUTES, { apiRequest } from '../../config/api';
import { TournamentStatus } from '../../types/tournament';
import { LeagueListItem } from '../../types/league';

interface TournamentListItem {
  _id: string;
  name: string;
  status: TournamentStatus;
  startDate: string;
  type?: 'grand-slam' | 'master-1000';
  format?: 'duos' | 'trios';
}

const STATUS_LABEL: Record<TournamentStatus, string> = {
  upcoming: 'Inscripciones abiertas',
  in_progress: 'En curso',
  completed: 'Finalizado'
};

const STATUS_COLOR: Record<TournamentStatus, { bgcolor: string; color: string }> = {
  upcoming: { bgcolor: 'info.main', color: 'info.contrastText' },
  in_progress: { bgcolor: '#FFD700', color: '#000' },
  completed: { bgcolor: 'success.main', color: 'success.contrastText' }
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

/** Página pública, sin login: para el visitante que solo quiere mirar qué
 *  hay dandose vueltas en la app antes de crear una cuenta. Trae TODOS los
 *  torneos y ligas (son endpoints ya públicos en el backend) ordenados por
 *  fecha, más nueva primero. */
const PublicExplore = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentListItem[] | null>(null);
  const [leagues, setLeagues] = useState<LeagueListItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      apiRequest(API_ROUTES.TOURNAMENTS.LIST) as Promise<TournamentListItem[]>,
      apiRequest(API_ROUTES.LEAGUES.LIST) as Promise<LeagueListItem[]>
    ])
      .then(([t, l]) => {
        if (!active) return;
        const byDateDesc = (a: { startDate: string }, b: { startDate: string }) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        setTournaments([...t].sort(byDateDesc));
        setLeagues([...l].sort(byDateDesc));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No pudimos cargar el listado');
      });

    return () => {
      active = false;
    };
  }, []);

  const loading = tournaments === null || leagues === null;

  return (
    <Box sx={{ bgcolor: 'background.default', overflowX: 'hidden' }}>
      <LandingNav />

      <Section maxWidth="md">
        <SectionHeading
          eyebrow="SIN LOGIN"
          title="Torneos y ligas en TrickApp"
          subtitle="Todo lo que se está jugando y organizando en la app, para que le eches un vistazo antes de crear tu cuenta."
        />

        {error && (
          <Typography color="error" align="center" sx={{ mt: 4 }}>
            {error}
          </Typography>
        )}

        {loading && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress color="gold" />
          </Box>
        )}

        {!loading && (
          <>
            <Reveal>
              <Typography variant="h6" sx={{ mt: 6, mb: 2, fontWeight: 700 }}>
                Torneos
              </Typography>
            </Reveal>

            {tournaments!.length === 0 ? (
              <Typography color="text.secondary">Todavía no hay torneos creados.</Typography>
            ) : (
              <Grid container spacing={2}>
                {tournaments!.map((t, i) => (
                  <Grid item xs={12} sm={6} key={t._id}>
                    <Reveal delay={(i % 6) * 40}>
                      <SurfaceCard
                        elevation={0}
                        sx={{ p: 2.5, cursor: 'pointer', height: '100%' }}
                        onClick={() => navigate(`/tournaments/${t._id}`)}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {t.name}
                          </Typography>
                          <Chip size="small" label={STATUS_LABEL[t.status]} sx={STATUS_COLOR[t.status]} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {formatDate(t.startDate)}
                          {t.format && ` · ${t.format === 'duos' ? 'Parejas' : 'Tríos'}`}
                        </Typography>
                      </SurfaceCard>
                    </Reveal>
                  </Grid>
                ))}
              </Grid>
            )}

            <Reveal>
              <Typography variant="h6" sx={{ mt: 6, mb: 2, fontWeight: 700 }}>
                Ligas
              </Typography>
            </Reveal>

            {leagues!.length === 0 ? (
              <Typography color="text.secondary">Todavía no hay ligas activas.</Typography>
            ) : (
              <Grid container spacing={2}>
                {leagues!.map((l, i) => (
                  <Grid item xs={12} sm={6} key={l._id}>
                    <Reveal delay={(i % 6) * 40}>
                      <SurfaceCard
                        elevation={0}
                        sx={{ p: 2.5, cursor: 'pointer', height: '100%' }}
                        onClick={() => navigate(`/leagues/${l._id}`)}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {l.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {formatDate(l.startDate)} · {l.tournamentCount}{' '}
                          {l.tournamentCount === 1 ? 'torneo' : 'torneos'} · {l.playerCount}{' '}
                          {l.playerCount === 1 ? 'jugador' : 'jugadores'}
                        </Typography>
                      </SurfaceCard>
                    </Reveal>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Section>

      <LandingFooter />
    </Box>
  );
};

export default PublicExplore;
