import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, CircularProgress, Grid, Button, Table, TableContainer, TableHead, TableCell, TableRow, TableBody, IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Pagination, Select, MenuItem, FormControl } from "@mui/material";
import { Visibility as VisibilityIcon, PlayArrow as PlayArrowIcon } from "@mui/icons-material";
import NavBar from "../../components/NavBar";
import API_ROUTES, { apiRequest } from "../../config/api";
import { isEmpty } from "lodash";
import { useNavigate } from "react-router-dom";

const cellSx = {
  px: 1,
  py: 0.5,
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const Stats = () => {
  const [matchStats, setMatchStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [matchLength, setMatchLength] = useState<number | null>(null);  
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [userTeam, setUserTeam] = useState<any>(null);
  const [oppositeTeam, setOppositeTeam] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  //const [showTournaments, setShowTournaments] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setLoading(false)
    //fetchUserMatchesLength()
  }, []);

  const fetchUserMatchesLength = async () => {
    try {
      const userId = localStorage.getItem("userId")
      const data = await apiRequest(API_ROUTES.USERS.MATCHESLENGTH(userId)); 
      setMatchLength(data.totalMatches);
    } catch (err) {
      setError("No se pudieron cargar las estadísticas.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    fetchUserMatchesLength()
    try {
      const userId = localStorage.getItem("userId")
      const skip = (currentPage - 1) * pageSize;
      const data = await apiRequest(API_ROUTES.USERS.STATS(userId), {
        method: 'GET',
        params: {
          skip,
          limit: pageSize
        }
      }); 
      setMatchStats(data);
      if(showMatches === false){
        setShowMatches(true);
      }
    } catch (err) {
      setError("No se pudieron cargar las estadísticas.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayMatch = (match : any) => {
    if (!match) return;

    navigate(`/matches/scoreboard/${match._id}`);
  }

const handleOpenDetails = async (match: any) => {
    try {
      setLoadingDetails(true);
      const userId = localStorage.getItem("userId");
      setSelectedMatch(match);

      console.log(match);
      const userTeamIndex = match?.teams?.findIndex((team: any) => 
        team?.players?.some((player: any) => player?.playerId === userId)
      );

      const userTeamData = match?.teams?.[userTeamIndex];
      const oppositeTeamData = match?.teams?.[userTeamIndex === 0 ? 1 : 0];

      const fetchPlayersData = async (players: any[]) => {
        if (!players) return [];
        
        const playersWithData = await Promise.all(
          players.map(async (player) => {
            try {
              if (player.isGuest === true) {
                return { ...player, fullData: { username: player.username } };
              }
              
              if (player.userName) {
                return { ...player, fullData: { username: player.userName } };
              }
              
              if (player.playerId) {
                const playerData = await apiRequest(API_ROUTES.USERS.GETNAMES(player.playerId));
                return { ...player, fullData: playerData };
              }
              
              return player;
            } catch (err) {
              return player;
            }
          })
        );
        return playersWithData;
      };

      if (userTeamData?.players) {
        const playersWithData = await fetchPlayersData(userTeamData.players);
        setUserTeam({ ...userTeamData, players: playersWithData });
      } else {
        setUserTeam(userTeamData);
      }

      if (oppositeTeamData?.players) {
        const playersWithData = await fetchPlayersData(oppositeTeamData.players);
        setOppositeTeam({ ...oppositeTeamData, players: playersWithData });
      } else {
        setOppositeTeam(oppositeTeamData);
      }

      setDetailsDialogOpen(true);
    } catch (err) {
      console.error('Error al abrir detalles:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false);
    setSelectedMatch(null);
  };


  return (
    <Box>
      <NavBar />
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ textAlign: "center", mb: 2 }}>
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
                <Typography variant="h4">{matchLength ?? 0}</Typography>
                <Button variant="contained" color='success' sx={{ mt: 1 }} onClick={() => isEmpty(matchStats) ? fetchUserStats() : setShowMatches(!showMatches)}>Ver Partidos</Button>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h6">Torneos Jugados</Typography>
                <Typography variant="h4">{matchStats?.wins ?? 0}</Typography>
                {/* <Button variant="outlined" sx={{ mt: 1 }} onClick={() => setShowTournaments(true)}>Ver Torneos</Button> */}
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
        {showMatches && (
          <Box mt={4}>
            <Typography variant="h5" textAlign='center' gutterBottom>Detalle de Partidos</Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.75rem', px: 1 }}>Tipo</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', px: 1 }}>Fecha</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', px: 1 }}>Resultado</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', px: 1 }} align="center">Detalles</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matchStats && matchStats.length > 0 ? (
                    matchStats?.map((match: any) => (
                      <TableRow key={match?._id}>                      
                        <TableCell sx={cellSx}>
                          <Chip
                            label={match?.type === 'friendly' ? 'F' : 'T'}
                            size="small"
                            sx={{
                              bgcolor: match?.type === 'friendly' ? '#FF9800' : '#4CAF50',
                              color: '#fff',
                              fontWeight: 'bold',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={cellSx}>{new Date(match?.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</TableCell>
                        <TableCell sx={cellSx}>
                          {match?.teams && match?.teams.length === 2 ? (
                            (() => {
                              const userId = localStorage.getItem("userId");
                              const userTeamIndex = match?.teams?.findIndex((team: any) => 
                                team?.players?.some((player: any) => player?.playerId === userId)
                              );
                              const userTeamScore = match?.teams?.[userTeamIndex]?.score;
                              const oppositeTeamScore = match?.teams?.[userTeamIndex === 0 ? 1 : 0]?.score;
                              const isWin = userTeamScore > oppositeTeamScore;
                              
                              return (
                                <Chip
                                  label={`${userTeamScore} vs ${oppositeTeamScore}`}
                                  size="small"
                                  sx={{
                                    bgcolor: isWin ? '#4CAF50' : '#F44336',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                  }}
                                />
                              );
                            })()
                          ) : (
                            `${match?.teams?.map((t: any) => `${t.score}`).join(" vs ")}`
                          )}
                        </TableCell>
                        <TableCell sx={cellSx} align="center">
                          <IconButton
                            size="small"
                            title="Ver detalles del partido"
                            sx={{
                              color: '#D4AF37',
                              '&:hover': {
                                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                              },
                            }}
                            onClick={() => handleOpenDetails(match)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        {match?.status !== 'finished' && (
                            <IconButton
                              size="small"
                              title="Jugar partido"
                              onClick={() => handlePlayMatch(match)}
                              sx={{
                                color: '#4CAF50',
                                '&:hover': {
                                  backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                },
                              }}
                            >
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                        )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mt: 0,
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 0 }
            }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                width: { xs: '100%', sm: 'auto' },
                justifyContent: { xs: 'space-between', sm: 'flex-start' }
              }}>
                <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  Registros por página:
                </Typography>
                <FormControl sx={{ minWidth: 70 }}>
                  <Select
                    size="small"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Pagination 
                count={Math.ceil((matchLength ?? 0) / pageSize)}
                page={currentPage}
                onChange={(e, value) => {
                  setCurrentPage(value);
                  fetchUserStats();
                }}
                color="primary"
                size="small"
                sx={{ 
                  '& .MuiPagination-ul': {
                    justifyContent: { xs: 'center', sm: 'flex-end' }
                  }
                }}
              />
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={detailsDialogOpen} onClose={handleCloseDetails} maxWidth="sm" fullWidth>
        <DialogTitle variant="h5" sx={{ display: 'flex', fontWeight: 'bold', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
          Detalles del Partido
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <CircularProgress />
            </Box>
          ) : (
            selectedMatch && (
              <Box >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Información
                </Typography>
                <Typography variant="body2">
                  <strong>Fecha:</strong> {new Date(selectedMatch.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </Typography>
                <Typography variant="body2">
                  <strong>Tipo:</strong> {selectedMatch.type === 'friendly' ? 'Amistoso' : 'Torneo'}
                </Typography>
                <Typography variant="body2">
                  <strong>Estado:</strong> {selectedMatch.status}
                </Typography>
              </Box>

              {userTeam && (
                <>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', mt: 2 }}>
                    Tu Equipo
                  </Typography>
                  {userTeam?.players && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(212, 175, 55, 0.1)', borderRadius: 1 }}>
                      {userTeam.players.map((player: any, idx: number) => (
                        <Typography key={idx} variant="body2" sx={{ py: 0.5 }}>
                          • {player.fullData?.username || player.name}
                        </Typography>
                      ))}
                      <Typography variant="body2" sx={{ py: 0.5, fontWeight: 'bold', color: '#D4AF37' }}>
                        Puntuación: {userTeam?.score}
                      </Typography>
                    </Box>
                  )}
                </>
              )}

              {oppositeTeam && (
                <>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', mt: 2 }}>
                    Equipo Contrario
                  </Typography>
                  {oppositeTeam?.players && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
                      {oppositeTeam.players.map((player: any, idx: number) => (
                        <Typography key={idx} variant="body2" sx={{ py: 0.5 }}>
                          • {player.fullData?.username || player.name}
                        </Typography>
                      ))}
                      <Typography variant="body2" sx={{ py: 0.5, fontWeight: 'bold' }}>
                        Puntuación: {oppositeTeam?.score}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </Box>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails} color="secondary" variant="contained">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Stats;