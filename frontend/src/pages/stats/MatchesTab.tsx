import React, { useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableContainer,
  TableHead,
  TableCell,
  TableRow,
  TableBody,
  IconButton,
  Chip,
  Paper,
  Pagination,
  Select,
  MenuItem,
  FormControl
} from '@mui/material';
import { Visibility as VisibilityIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUserMatches } from '../../hooks/useUserMatches';
import MatchDetailsDialog from './MatchDetailsDialog';
import { UserMatch } from '../../types/userStats';

interface MatchesTabProps {
  userId: string;
}

const cellSx = {
  px: 1,
  py: 0.5,
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const MatchesTab: React.FC<MatchesTabProps> = ({ userId }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedMatch, setSelectedMatch] = useState<UserMatch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { matches, total, loading, error } = useUserMatches(userId, page, pageSize);

  const handleOpenDetails = (match: UserMatch) => {
    setSelectedMatch(match);
    setDialogOpen(true);
  };

  const handlePlayMatch = (match: UserMatch) => {
    navigate(`/matches/scoreboard/${match._id}`);
  };

  if (loading && matches.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (matches.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        Todavía no jugaste ningún partido.
      </Typography>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '0.75rem', px: 1 }}>Tipo</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', px: 1 }}>Fecha</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', px: 1 }}>Resultado</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', px: 1 }} align="center">
                Detalles
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.map((match) => {
              const userTeamIndex = match.teams.findIndex((team) => team.players.some((p) => p.playerId === userId));
              const userTeamScore = match.teams[userTeamIndex]?.score;
              const oppositeTeamScore = match.teams[userTeamIndex === 0 ? 1 : 0]?.score;
              const isWin = match.teams.length === 2 && userTeamScore !== undefined && userTeamScore > (oppositeTeamScore ?? 0);

              return (
                <TableRow key={match._id}>
                  <TableCell sx={cellSx}>
                    <Chip
                      label={match.type === 'friendly' ? 'F' : 'T'}
                      size="small"
                      sx={{ bgcolor: match.type === 'friendly' ? '#FF9800' : '#4CAF50', color: '#fff', fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {new Date(match.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {match.teams.length === 2 ? (
                      <Chip
                        label={`${userTeamScore} vs ${oppositeTeamScore}`}
                        size="small"
                        sx={{ bgcolor: isWin ? '#4CAF50' : '#F44336', color: '#fff', fontWeight: 'bold' }}
                      />
                    ) : (
                      match.teams.map((t) => t.score).join(' vs ')
                    )}
                  </TableCell>
                  <TableCell sx={cellSx} align="center">
                    <IconButton
                      size="small"
                      title="Ver detalles del partido"
                      sx={{ color: '#D4AF37', '&:hover': { backgroundColor: 'rgba(212, 175, 55, 0.15)' } }}
                      onClick={() => handleOpenDetails(match)}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    {match.status !== 'finished' && (
                      <IconButton
                        size="small"
                        title="Jugar partido"
                        onClick={() => handlePlayMatch(match)}
                        sx={{ color: '#4CAF50', '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.15)' } }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'space-between', sm: 'flex-start' } }}>
          <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
            Registros por página:
          </Typography>
          <FormControl sx={{ minWidth: 70 }}>
            <Select
              size="small"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Pagination
          count={Math.max(1, Math.ceil(total / pageSize))}
          page={page}
          onChange={(_, value) => setPage(value)}
          color="primary"
          size="small"
          sx={{ '& .MuiPagination-ul': { justifyContent: { xs: 'center', sm: 'flex-end' } } }}
        />
      </Box>

      <MatchDetailsDialog
        match={selectedMatch}
        userId={userId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </Box>
  );
};

export default MatchesTab;
