import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, CircularProgress, Grid } from "@mui/material";
import NavBar from "../../components/NavBar";
import API_ROUTES, { apiRequest } from "../../config/api";

const Stats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiRequest(API_ROUTES.USERS.STATS); 
        setStats(data);
      } catch (err) {
        setError("No se pudieron cargar las estadísticas.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
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
            {/* Ejemplo de estadísticas, ajusta según tu modelo */}
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h6">Torneos Jugados</Typography>
                <Typography variant="h4">{stats?.tournamentsPlayed ?? 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h6">Victorias</Typography>
                <Typography variant="h4">{stats?.wins ?? 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h6">Puntos Totales</Typography>
                <Typography variant="h4">{stats?.totalPoints ?? 0}</Typography>
              </Paper>
            </Grid>
            {/* Agrega más estadísticas aquí */}
          </Grid>
        )}
      </Box>
    </Box>
  );
};

export default Stats;