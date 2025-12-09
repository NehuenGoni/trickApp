import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import {
  SportsEsports as GameIcon,
  EmojiEvents as TournamentIcon,
  Timeline as LeagueIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';

const Dashboard = () => {
  const navigate = useNavigate();

  const cards = [
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
        <Typography variant="h4" gutterBottom align="center">
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
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: 6
                  }
                }}
                onClick={card.action}
              >
                <CardContent sx={{ 
                  flexGrow: 1, 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  {card.icon}
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