import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  IconButton,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ExitToApp as ExitIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface Team {
  teamId: string;
  score: number;
}

interface Match {
  _id: string;
  tournament?: string;
  teams: Team[];
  winner?: string;
  status: "in_progress" | "finished";
  createdAt: string;
}

const MAX_SCORE = 30;

const Scoreboard = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState('');
  const [teamDetails, setTeamDetails] = useState<{[key: string]: { username: string }}>({}); // Para almacenar detalles de los equipos
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  const fetchMatch = async () => {
    if (!matchId) {
      setError('ID de partido no válido');
      return;
    }

    try {
      const matchData = await apiRequest(API_ROUTES.MATCHES.GET(matchId));
      setMatch(matchData);
      
      // Obtenemos los detalles de los equipos
      const teamIds = matchData.teams.map((team: { teamId: string }) => team.teamId).filter(Boolean);
      const teamsData: {[key: string]: { username: string }} = {};
      
      for (const teamId of teamIds) {
        try {
          const teamData = await apiRequest(API_ROUTES.USERS.DETAIL(teamId));
          teamsData[teamId] = teamData;
        } catch (err) {
          console.error(`Error al obtener detalles del equipo ${teamId}:`, err);
        }
      }
      
      setTeamDetails(teamsData);
    } catch (err) {
      console.error('Error al cargar el partido:', err);
      setError('Error al cargar el partido');
    }
  };

  const handleScoreChange = async (teamIndex: number, change: number) => {
    if (!match) return;

    const newScore = match.teams[teamIndex].score + change;
    if (newScore < 0 || newScore > MAX_SCORE) return;

    try {
      const updatedTeams = [...match.teams];
      updatedTeams[teamIndex] = {
        ...updatedTeams[teamIndex],
        score: newScore
      };

      const updatedMatch = {
        ...match,
        teams: updatedTeams
      };

      // Si alguien llegó a 30, el partido termina
      if (newScore === MAX_SCORE) {
        updatedMatch.status = "finished";
        updatedMatch.winner = updatedMatch.teams[teamIndex].teamId;
      }

      const response = await apiRequest(API_ROUTES.MATCHES.UPDATE(match._id), {
        method: 'PUT',
        body: JSON.stringify(updatedMatch)
      });

      setMatch(response);
    } catch (err) {
      setError('Error al actualizar la puntuación');
    }
  };

  const handleExit = () => {
    setExitDialogOpen(true);
  };

  const handleSaveAndExit = async () => {
    try {
      if (!matchId || !match) return;

      await apiRequest(API_ROUTES.MATCHES.UPDATE(matchId), {
        method: 'PUT',
        body: JSON.stringify({
          teams: match.teams,
          status: 'in_progress'
        })
      });
      navigate('/matches/in-progress');
    } catch (err) {
      setError('Error al guardar el partido');
    }
  };

  const handleDeleteAndExit = async () => {
    try {
      if (!matchId) return;
      
      await apiRequest(API_ROUTES.MATCHES.DELETE(matchId), {
        method: 'DELETE'
      });
      navigate('/matches/in-progress');
    } catch (err) {
      setError('Error al eliminar el partido');
    }
  };

  const renderTeamScore = (teamIndex: number) => {
    if (!match) return null;
    const team = match.teams[teamIndex];
    const isWinner = match.winner === team.teamId;
    const teamName = teamDetails[team.teamId]?.username || `Equipo ${teamIndex + 1}`;

    return (
      <Paper 
        elevation={3} 
        sx={{ 
          p: 3,
          textAlign: 'center',
          bgcolor: isWinner ? '#e8f5e9' : 'background.paper'
        }}
      >
        <Typography variant="h6" gutterBottom>
          {teamName}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
          <IconButton 
            onClick={() => handleScoreChange(teamIndex, -1)}
            disabled={match.status === "finished" || team.score <= 0}
          >
            <RemoveIcon />
          </IconButton>
          <Typography variant="h3">
            {team.score}
          </Typography>
          <IconButton 
            onClick={() => handleScoreChange(teamIndex, 1)}
            disabled={match.status === "finished" || team.score >= MAX_SCORE}
          >
            <AddIcon />
          </IconButton>
        </Box>
      </Paper>
    );
  };

  if (!match) {
    return (
      <Box>
        <NavBar />
        <Container>
          <Alert severity="info">Cargando datos del partido...</Alert>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ExitIcon />}
            onClick={handleExit}
          >
            Salir
          </Button>
        </Box>

        <Typography variant="h4" gutterBottom align="center">
          Partido {match.status === "finished" ? "Terminado" : "en Curso"}
        </Typography>

        {match.status === "finished" && match.winner && (
          <Alert severity="success" sx={{ mb: 2 }}>
            ¡Partido terminado! Ganador: {teamDetails[match.winner]?.username || 'Equipo Ganador'}
          </Alert>
        )}

        <Grid container spacing={4} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            {renderTeamScore(0)}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderTeamScore(1)}
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/dashboard')}
          >
            Volver al Dashboard
          </Button>
          {match.status === "finished" && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/matches/create')}
            >
              Nuevo Partido
            </Button>
          )}
        </Box>

        <Dialog
          open={exitDialogOpen}
          onClose={() => setExitDialogOpen(false)}
        >
          <DialogTitle>¿Qué deseas hacer con el partido?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Puedes guardar el partido para continuarlo más tarde o eliminarlo permanentemente.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
            <Button
              onClick={() => setExitDialogOpen(false)}
              variant="outlined"
            >
              Cancelar
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={handleDeleteAndExit}
                color="error"
                variant="contained"
              >
                Eliminar Partido
              </Button>
              <Button
                onClick={handleSaveAndExit}
                color="primary"
                variant="contained"
              >
                Guardar y Salir
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default Scoreboard; 