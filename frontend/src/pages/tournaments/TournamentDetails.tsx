import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { isEmpty } from 'lodash';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import API_ROUTES, { apiRequest } from '../../config/api';

interface Match {
  winner: any;
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

  const quarterFinals = matches.filter(
    (m) => m.phase === "quarter-finals"
  );

  const semifinalsGold = matches.filter(
    (m) => m.phase === "semifinals-gold"
  );

  const semifinals = matches.filter(
    (m) => m.phase === "semifinals"
  );

  const finalGold = matches.filter(
    (m) => m.phase === "final-gold"
  );

  const final = matches.filter(
    (m) => m.phase === "final"
  );

  const renderParticipants = (players: { playerId: string }[], teamId: string) => {
    const team = tournament?.teams.find(t => t.teamId === teamId);

    if (!team || team.players.length === 0) {
      return null;
    }

    return (
      <Box>
        {team.players.map((p) => (
          <Typography
            key={p.playerId}
            sx={{
              fontSize: {
                xs: '0.75rem',  
                sm: '0.85rem',
                md: '0.9rem'
              },
              lineHeight: 1.2,
              whiteSpace: 'nowrap',   
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {p.name}
          </Typography>
        ))}
      </Box>
    );
  };

  const renderTeams = (teamId: string) => {
    const team = tournament?.teams.find(t => t.teamId === teamId);
    return team?.name
  };

  const getWinnersNames = (match: Match, tournament: Tournament) => {
    const winningTeam = match.teams.find(team => team.teamId === match.winner);
    const names = winningTeam?.players.map((p: any) => {
      const player = tournament.teams
        .flatMap(t => t.players)
        .find(tp => tp.playerId === p.playerId);
      return player ? player.name : 'Invitado';
    });

    if (!winningTeam) return 'Equipo no encontrado';

    return names?.length
    ? (
        <>
          {names.map((name: String) => (
            <Typography variant="body2">
              👑 {name}
            </Typography>
          ))}
        </>
      )
    : 'Invitados';
  }

  const renderMatchCard = (match: Match) => {
    const userInMatch = isUserInMatch(match, currentUserId);

    console.log('Rendering match:', match);
    return (
      <Grid item xs={12} key={match._id}>
        <Paper sx={{ p: 2 }}>
          {/* HEADER */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontSize: { xs: "1rem", sm: "1.3rem" }, fontWeight: "bold" }}
            >
              {`${match.teams[0]?.score} - ${match.teams[1]?.score}`}
            </Typography>

            <Chip
              label={match.status === "in_progress" ? "En progreso" : "Finalizado"}
              color={match.status === "in_progress" ? "warning" : "success"}
              sx={{
                height: { xs: 18, sm: 24 },
                fontSize: { xs: "0.55rem", sm: "0.75rem" },
              }}
            />
          </Box>

          {/* TEAMS */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            {[0, 1].map((idx) => (
              <Box key={idx}>
                <Typography sx={{ fontSize: { xs: "0.9rem", sm: "1.1rem" } }}>
                  {renderTeams(match.teams[idx]?.teamId)}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: { xs: "0.75rem", sm: "0.85rem" } }}
                >
                  {renderParticipants(
                    match.teams[idx]?.players ?? [],
                    match.teams[idx]?.teamId
                  )}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* PLAY */}
          {userInMatch && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button
                variant="contained"
                startIcon={match.status === "in_progress" ? <PlayArrowIcon /> : null }
                disabled={match.status !== "in_progress"}
                onClick={() => handlePlay(match._id)}
                sx={{
                  backgroundColor: "#fbc02d", 
                  color: "#000",
                  fontWeight: "bold",
                  px: { xs: 2, sm: 4 },
                  py: { xs: 0.6, sm: 1.2 },
                  fontSize: { xs: "0.85rem", sm: "1rem" },
                  borderRadius: 2,
                  "&:hover": {
                    backgroundColor: "#D4AF37",
                  },
                }}
              >
                {match.status === "in_progress" ? "Jugar" : "Finalizado"}
              </Button>
            </Box>
          )}
        </Paper>
      </Grid>
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
          <Alert severity="error">Torneo no encontrado</Alert> <CircularProgress />
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
              Fecha del Torneo: {new Date(tournament.startDate).toLocaleDateString()}
            </Typography>
            <Chip 
              label={getStatusText(tournament.status)}
              color={getStatusColor(tournament.status)}
              sx={{ mt: 1 }}
            />
          </Box>
          {
            !isEmpty(finalGold) && finalGold.filter(m => m.status === "finished").length === finalGold.length && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              Ganadores del torneo:
              {finalGold.map((match, idx) => (
                <Typography key={idx} variant="body2">
                  {getWinnersNames(match, tournament)}
                </Typography>
              ))}
            </Typography>
          </Box>  
            )}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Partidos del Torneo
            </Typography>
          </Box>
          <Divider sx={{ my: 1 }} />

          <Box sx={{ mb: 2, alignContent: 'center' }}>
            <Accordion >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">
                  Cuartos de Final
                </Typography>
              </AccordionSummary>

              <AccordionDetails>
                <Grid container spacing={3}>
                  {quarterFinals.map(renderMatchCard)}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Box>
          {
            !isEmpty(semifinalsGold) && (
            <Box sx={{ mb: 2, alignContent: 'center' }}>
              <Accordion >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight="bold">
                    Semifinales de Oro
                  </Typography>
                </AccordionSummary>

                <AccordionDetails>
                  <Grid container spacing={3}>
                    {semifinalsGold.map(renderMatchCard)}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
            )
          }
          {
            !isEmpty(semifinals) && (
            <Box sx={{ mb: 2, alignContent: 'center' }}>
              <Accordion >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight="bold">
                    Semifinales de Plata
                  </Typography>
                </AccordionSummary>

                <AccordionDetails>
                  <Grid container spacing={3}>
                    {semifinals.map(renderMatchCard)}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
            )
          }
          {
            !isEmpty(finalGold) && (
            <Box sx={{ mb: 2, alignContent: 'center' }}>
              <Accordion >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight="bold">
                    Final Oro
                  </Typography>
                </AccordionSummary>

                <AccordionDetails>
                  <Grid container spacing={3}>
                    {finalGold.map(renderMatchCard)}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
            )
          }
          {
            !isEmpty(final) && (
            <Box sx={{ mb: 2, alignContent: 'center' }}>
              <Accordion >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight="bold">
                    Final Plata
                  </Typography>
                </AccordionSummary>

                <AccordionDetails>
                  <Grid container spacing={3}>
                    {final.map(renderMatchCard)}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
            )
          }
        </Paper>
      </Container>
    </Box>
  );
};

export default TournamentDetails; 