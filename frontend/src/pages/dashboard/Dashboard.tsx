import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip
} from '@mui/material';
import {
  SportsEsports as GameIcon,
  EmojiEvents as TournamentIcon,
  Leaderboard as LeagueIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import AppLogo from '../../components/AppLogo';

const Dashboard = () => {
  const navigate = useNavigate();

  const cards: {
    title: string;
    description: string;
    icon: React.ReactNode;
    action?: () => void;
    comingSoon?: boolean;
  }[] = [
    {
      title: 'Partido Rápido',
      description: 'Crea un partido rápido de parejas o tríos',
      icon: <GameIcon sx={{ fontSize: 40 }} />,
      action: () => navigate('/matches/create')
    },
    {
      title: 'Torneos',
      description: 'Organiza y participa en torneos',
      icon: <TournamentIcon sx={{ fontSize: 40 }} />,
      action: () => navigate('/tournaments')
    },
    {
      title: 'Ligas',
      description: 'Compite en ligas a largo plazo',
      icon: <LeagueIcon sx={{ fontSize: 40 }} />,
      action: () => navigate('/leagues')
    }
  ];

  return (
    <Box>
      <NavBar />
      <Container sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <AppLogo size={96} />
        </Box>

        <Typography variant="h4" gutterBottom align="center" sx={{ color: '#FFD700', fontWeight: 700 }}>
          ¡Bienvenido a TrickApp!
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {cards.map((card, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  cursor: card.comingSoon ? 'default' : 'pointer',
                  opacity: card.comingSoon ? 0.6 : 1,
                  border: '1px solid transparent',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  ...(!card.comingSoon && {
                    '&:hover': {
                      borderColor: '#FFD700',
                      boxShadow: '0px 4px 12px rgba(0,0,0,0.4)'
                    }
                  })
                }}
                onClick={card.action}
              >
                {card.comingSoon && (
                  <Chip
                    label="Próximamente"
                    color="secondary"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12 }}
                  />
                )}
                <CardContent sx={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  <Box sx={{ color: '#FFD700' }}>{card.icon}</Box>
                  <Typography variant="h6" component="h2" sx={{ mt: 2 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {card.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard; 