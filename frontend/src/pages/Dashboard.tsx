import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import NavBar from '../components/NavBar';

const Dashboard = () => {
  const navigate = useNavigate();

  const options = [
    {
      title: 'Partido Rápido',
      description: 'Crea un partido individual sin torneo',
      icon: <SportsSoccerIcon sx={{ fontSize: 60 }} />,
      path: '/match/new'
    },
    {
      title: 'Torneo',
      description: 'Organiza un torneo completo',
      icon: <EmojiEventsIcon sx={{ fontSize: 60 }} />,
      path: '/tournament/new'
    },
    {
      title: 'Liga',
      description: 'Crea una liga con múltiples torneos',
      icon: <WorkspacePremiumIcon sx={{ fontSize: 60 }} />,
      path: '/league/new'
    }
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <NavBar />
      <Container sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          ¿Qué quieres hacer?
        </Typography>
        
        <Grid container spacing={3}>
          {options.map((option) => (
            <Grid item xs={12} sm={6} md={4} key={option.title}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    boxShadow: 6,
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  {option.icon}
                  <Typography gutterBottom variant="h5" component="h2">
                    {option.title}
                  </Typography>
                  <Typography>
                    {option.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button 
                    size="large" 
                    fullWidth 
                    variant="contained"
                    onClick={() => navigate(option.path)}
                  >
                    Comenzar
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;
  