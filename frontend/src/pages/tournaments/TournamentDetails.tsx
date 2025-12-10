import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Chip,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface Match {
  _id: string;
  tournamentId: string;
  teams: any[];
  phase: string;
  status: string;
}

interface Team {
  teamId: string;
  name: string;
  players: Array<{
    name: string;
    playerId?: string;
    isGuest?: boolean;
  }>;
}

interface Tournament {
  _id: string;
  name: string;
  description: string;
  startDate: string;
  status: string;
  teams: Team[];
}

const TournamentDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matchesIds, setMatchesIds] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentUserId = localStorage.getItem('userId') || '';

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" } = {
      'scheduled': 'default',
      'in_progress': 'primary',
      'completed': 'success',
      'cancelled': 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const statuses: { [key: string]: string } = {
      'scheduled': 'Programado',
      'in_progress': 'En Curso',
      'completed': 'Finalizado',
      'cancelled': 'Cancelado'
    };
    return statuses[status] || status;
  };

  const fetchTournamentData = useCallback ( async () => {
    try {
      const tournamentData = await apiRequest(API_ROUTES.TOURNAMENTS.GET(id!));
      setTournament(tournamentData);
      setMatchesIds(tournamentData.matches);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar los datos del torneo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTournamentData()
  }, [fetchTournamentData]);

  useEffect(() => {
    fetchMatches(matchesIds);
  }, [matchesIds]);

  const fetchMatches = async (ids: string[]) => {
    try {
      setLoading(true);
      const responses = await Promise.all(
        ids.map((id) => apiRequest(API_ROUTES.MATCHES.GET(id)))
      );
      const matchesData = responses.map((res) => res);
      setMatches(matchesData);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const isUserInMatch = (match: any, userId: string) => {
    return match.teams.some((team: any) =>
      team.players.some((p: any) => p.playerId === userId)
    );
  };

  const handlePlay = (matchId: string) => {
    navigate(`/matches/scoreboard/${matchId}`);
  };

  if (loading) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }

  if (!tournament) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error">Torneo no encontrado</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            {tournament.name}
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" color="text.secondary">
              {tournament.description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fecha de inicio: {new Date(tournament.startDate).toLocaleDateString()}
            </Typography>
            <Chip 
              label={getStatusText(tournament.status)}
              color={getStatusColor(tournament.status)}
              sx={{ mt: 1 }}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" gutterBottom>
            Partidos del Torneo
          </Typography>

          <Grid container spacing={3}>
            {matches.map((match) => {
              const userInMatch = isUserInMatch(match, currentUserId);

              return (
                <Grid item xs={12} key={match._id}>
                  <Paper sx={{ p: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Chip
                        label={match.status === "in_progress" ? "En progreso" : "Finalizado"}
                        color={match.status === "in_progress" ? "warning" : "success"}
                        size="small"
                      />
                    </Box>

                    {/* Equipos y score */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="h6">
                        Equipo 1 (score: {match.teams[0]?.score ?? 0})
                      </Typography>

                      <Typography variant="h6" sx={{ mx: 2 }}>
                        {match.status === "finished"
                          ? `${match.teams[0]?.score} - ${match.teams[1]?.score}`
                          : "vs"}
                      </Typography>

                      <Typography variant="h6">
                        Equipo 2 (score: {match.teams[1]?.score ?? 0})
                      </Typography>
                    </Box>

                    {/* Botón de jugar solo si el user participa */}
                    {userInMatch && (
                      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                        <IconButton color="primary" onClick={() => handlePlay(match._id)}>
                          <PlayArrowIcon />
                        </IconButton>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default TournamentDetails; 