import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  ExitToApp as ExitIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';
import { useWakeLock } from '../../hooks/useWakeLock';
import { MAX_SCORE, getScoreStage, getDisplayScore } from '../../utils/truco';

interface Team {
  teamId: string;
  score: number;
  players: Player[]
}

interface Player {
  playerId: string;
  username: string;
  isGuest?: boolean;
}

interface Match {
  _id: string;
  tournament?: string;
  teams: Team[];
  winner?: string;
  status: "in_progress" | "finished";
  createdAt: string;
}

// Espectadores en /live/:id sondean el estado cada ~2.5s (ver useLiveTournament),
// así que bajar este debounce reduce la latencia total percibida en la pantalla
// de transmisión (antes: 0.8s + poll ≈ 3.3s peor caso; ahora ≈ 2.9s).
const DEBOUNCE_MS = 400;

const Scoreboard = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState('');
  //const [teamDetails, setTeamDetails] = useState<{[key: string]: { username: string }}>({})
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [userLogged, setUserLogged] = useState<string>('');

  // Ref siempre sincronizado con el último estado del match, para que el
  // debounce/flush pueda leer el valor más reciente sin depender del closure.
  const matchRef = useRef<Match | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWakeLock(match?.status === 'in_progress');

  const fetchMatch = useCallback ( async () => {
    if (!matchId) {
      setError('ID de partido no válido');
      return;
    }

    try {
      const matchData = await apiRequest(API_ROUTES.MATCHES.GET(matchId));

      if (!matchData || !Array.isArray(matchData.teams)) {
        throw new Error('Datos del partido inválidos');
      }

      setMatch(matchData);
      matchRef.current = matchData;

      const data = await apiRequest(API_ROUTES.AUTH.PROFILE);
      setUserLogged(data.user._id)

      const teamIds = matchData.teams.map((team: { teamId: string }) => team.teamId).filter(Boolean);
      const teamsData: {[key: string]: { username: string }} = {};
      
      for (const teamId of teamIds) {
        try {
          const teamData = await apiRequest(API_ROUTES.TEAMS.DETAIL(teamId));
          teamsData[teamId] = teamData;
        } catch (err) {
          console.error(`Error al obtener detalles del equipo ${teamId}:`, err);
        }
      }
      
    } catch (err) {
      console.error('Error al cargar el partido:', err);
      setError('Error al cargar el partido');
    }
  }, [matchId])

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  // Cancela el debounce pendiente (si existe) y sincroniza el score actual
  // con el backend vía el endpoint liviano de score. Se usa tanto para el
  // guardado diferido normal como para los "flush" forzados (salir, ocultar
  // pestaña, desmontar).
  const flushPendingScore = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const current = matchRef.current;
    if (!current || current.status !== 'in_progress') return;

    try {
      await apiRequest(API_ROUTES.MATCHES.UPDATE_SCORE(current._id), {
        method: 'PATCH',
        body: JSON.stringify({
          scores: current.teams.map(t => ({ teamId: t.teamId, score: t.score }))
        })
      });
    } catch (err) {
      setError('Error al sincronizar la puntuación');
      // Resincroniza el estado local con lo que realmente quedó guardado.
      fetchMatch();
    }
  }, [fetchMatch]);

  // Cleanup: al desmontar, si quedó un cambio de score sin sincronizar, se
  // fuerza el guardado. También cubre el caso de cambiar de pestaña/app
  // (visibilitychange/pagehide), relevante porque la pantalla se mantiene
  // encendida con useWakeLock mientras el partido está en curso.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingScore();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushPendingScore);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushPendingScore);
      flushPendingScore();
    };
  }, [flushPendingScore]);

  const finalizeMatch = async (updatedMatch: Match) => {
    try {
      const response = await apiRequest(API_ROUTES.MATCHES.UPDATE(updatedMatch._id), {
        method: 'PUT',
        body: JSON.stringify(updatedMatch)
      });
      setMatch(response);
      matchRef.current = response;
    } catch (err) {
      setError('Error al actualizar la puntuación');
      fetchMatch();
    }
  };

  const handleScoreChange = (teamIndex: number, change: number) => {
    const current = matchRef.current;
    if (!current) return;

    const newScore = current.teams[teamIndex].score + change;
    if (newScore < 0 || newScore > MAX_SCORE) return;

    const updatedTeams = [...current.teams];
    updatedTeams[teamIndex] = {
      ...updatedTeams[teamIndex],
      score: newScore
    };

    const updatedMatch: Match = {
      ...current,
      teams: updatedTeams
    };

    if (newScore === MAX_SCORE) {
      updatedMatch.status = "finished";
      updatedMatch.winner = updatedMatch.teams[teamIndex].teamId;
    }

    // Optimistic update: la UI refleja el punto al instante, sin esperar al backend.
    setMatch(updatedMatch);
    matchRef.current = updatedMatch;

    if (newScore === MAX_SCORE) {
      // La finalización nunca se difiere: se cancela cualquier debounce
      // pendiente y se guarda de inmediato (dispara avance de bracket, etc.).
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      finalizeMatch(updatedMatch);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushPendingScore();
    }, DEBOUNCE_MS);
  };

  const handleExit = async () => {
    if (match && match?.tournament === 'friendly_matches' && match.status === 'in_progress') {
      await handleDeleteAndExit();
    } else {
      await flushPendingScore();
    }
    navigate('/dashboard');
  };

  const handleSaveAndExit = async () => {
    try {
      if (!matchId || !match) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

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

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

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
    let teamName
    let myTeam

    for(let player of team.players){
      if(player.playerId === userLogged){
        myTeam = true
      }
    }
    
    if(myTeam){
      teamName = 'Nosotros'
    } else {
      teamName = 'Ellos'
    }

    const stage = getScoreStage(team.score);

    return (
    <Box>
      <Typography variant="h5" gutterBottom align="center" sx={{ fontWeight: 'bold', mb: 2 }}>
        {teamName}
      </Typography>
      <Typography
        variant="subtitle2"
        align="center"
        sx={{
          fontWeight: 'bold',
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: stage.color,
        }}
      >
        {stage.label}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 2,
          mb: 2,
          mt: 2,
        }}
      >
        <Button
          variant="contained"
          onClick={() => handleScoreChange(teamIndex, -1)}
          disabled={match.status === "finished" || team.score <= 0}
          sx={{
            minWidth: 56,
            bgcolor: '#D4AF37',
            color: '#000',
            fontSize: '2rem',
            fontWeight: 'bold',
            '&:hover': {
              bgcolor: '#c29d2e',
            },
            '&:disabled': {
              bgcolor: '#e0d3a0',
              color: '#777',
            },
          }}
        >
          −
        </Button>

        <Typography
          variant="h3"
          sx={{
            minWidth: 80,
            textAlign: 'center',
            fontWeight: 'bold',
            color: stage.color,
            transition: 'color 0.2s ease',
          }}
        >
          {getDisplayScore(team.score)}
        </Typography>

        <Button
          variant="contained"
          onClick={() => handleScoreChange(teamIndex, 1)}
          disabled={match.status === "finished" || team.score >= MAX_SCORE}
          sx={{
            minWidth: 56,
            bgcolor: '#D4AF37',
            color: '#000',
            fontSize: '2rem',
            fontWeight: 'bold',
            '&:hover': {
              bgcolor: '#c29d2e',
            },
            '&:disabled': {
              bgcolor: '#e0d3a0',
              color: '#777',
            },
          }}
        >
          +
        </Button>
      </Box>
    </Box>
    );
  };

  const formatUsernames = () => {
    const usernames =
      match?.teams
        .find(team => team.teamId === match?.winner)
        ?.players
        ?.map(p => p.username) ?? [];

    return usernames
      .map((name, idx) => {
        if (idx === usernames.length - 1) return name;
        if (idx === usernames.length - 2) return name + " y ";
        return name + ", ";
      })
      .join("");
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
            variant="contained"
            color="secondary"
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
            ¡Partido terminado! Ganadores: {formatUsernames()|| 'Equipo Ganador'}
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
            variant="contained"
            color="primary"
            onClick={handleExit}
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