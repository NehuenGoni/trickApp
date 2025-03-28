import React, { useState, useEffect } from 'react';
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
  Chip
} from '@mui/material';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface Match {
  _id: string;
  tournamentId: string;
  team1: {
    teamId: string;
    score: number;
  };
  team2: {
    teamId: string;
    score: number;
  };
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
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTournamentData = async () => {
      try {
        // Obtener datos del torneo
        const tournamentData = await apiRequest(API_ROUTES.TOURNAMENTS.GET(id!));
        setTournament(tournamentData);

        // Obtener partidos del torneo
        const matchesData = await apiRequest(API_ROUTES.MATCHES.GET_BY_TOURNAMENT(id!));
        setMatches(matchesData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error al cargar los datos del torneo');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTournamentData();
    }
  }, [id]);

  const getTeamName = (teamId: string) => {
    return tournament?.teams.find(team => team.teamId === teamId)?.name || 'Equipo desconocido';
  };

  const getPhaseName = (phase: string) => {
    const phases: { [key: string]: string } = {
      'quarter-finals': 'Cuartos de Final',
      'semi-finals': 'Semifinales',
      'final': 'Final',
      'third-place': 'Tercer y Cuarto Puesto'
    };
    return phases[phase] || phase;
  };

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
            {matches.map((match) => (
              <Grid item xs={12} key={match._id}>
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1">
                      {getPhaseName(match.phase)}
                    </Typography>
                    <Chip 
                      label={getStatusText(match.status)}
                      color={getStatusColor(match.status)}
                      size="small"
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">
                      {getTeamName(match.team1.teamId)}
                    </Typography>
                    <Typography variant="h6" sx={{ mx: 2 }}>
                      {match.status === 'completed' ? `${match.team1.score} - ${match.team2.score}` : 'vs'}
                    </Typography>
                    <Typography variant="h6">
                      {getTeamName(match.team2.teamId)}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default TournamentDetails; 