import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, CircularProgress, Grid, Button, Table, TableContainer, TableHead, TableCell, TableRow, TableBody } from "@mui/material";
import NavBar from "../../components/NavBar";
import API_ROUTES, { apiRequest } from "../../config/api";

const Stats = () => {
  const [matchStats, setMatchStats] = useState<any>(null);
  const [tournamentStats, setTournamentStats] = useState<any>(null);
  const [stats, setStats] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const userId = localStorage.getItem("userId")
        const data = await apiRequest(API_ROUTES.USERS.STATS(userId)); 
        setMatchStats(data);
      } catch (err) {
        setError("No se pudieron cargar las estadísticas.");
      } finally {
        setLoading(false);
      }
    };
    fetchUserStats();
  }, []);


  return (
    <Box>
      <NavBar />
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Mis Estadísticas
        </Typography>
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h6">Partidos Jugados</Typography>
                <Typography variant="h4">{matchStats?.length ?? 0}</Typography>
                <Button variant="outlined" sx={{ mt: 1 }} onClick={() => setShowMatches(true)}>Ver Partidos</Button>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h6">Torneos Jugados</Typography>
                <Typography variant="h4">{matchStats?.wins ?? 0}</Typography>
                <Button variant="outlined" sx={{ mt: 1 }} onClick={() => setShowTournaments(true)}>Ver Torneos</Button>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h6">Puntos Totales</Typography>
                <Typography variant="h4">{matchStats?.totalPoints ?? 0}</Typography>
              </Paper>
            </Grid>
          </Grid>
        )}
        {showMatches && matchStats.length > 0 && (
          <Box mt={4}>
            <Typography variant="h5" gutterBottom>Detalle de Partidos</Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Resultado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matchStats.map((match: any) => (
                    <TableRow key={match._id}>
                      <TableCell>{new Date(match.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{match.type}</TableCell>
                      <TableCell>{match.status}</TableCell>
                      <TableCell>
                        {match.teams?.map((t: any) => `${t.score}`).join(" vs ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Stats;