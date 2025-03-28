import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import Profile from './pages/profile/Profile';
import CreateMatch from './pages/matches/CreateMatch';
import Scoreboard from './pages/matches/Scoreboard';
import TournamentList from './pages/tournaments/TournamentList';
import CreateTournament from './pages/tournaments/CreateTournament';
import TournamentDetails from './pages/tournaments/TournamentDetails';
import PrivateRoute from './components/PrivateRoute';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />

          <Route path="/matches/create" element={
            <PrivateRoute>
              <CreateMatch />
            </PrivateRoute>
          } />

          <Route path="/matches/scoreboard/:matchId" element={
            <PrivateRoute>
              <Scoreboard />
            </PrivateRoute>
          } />

          <Route path="/tournaments" element={
            <PrivateRoute>
              <TournamentList />
            </PrivateRoute>
          } />

          <Route path="/tournaments/create" element={
            <PrivateRoute>
              <CreateTournament />
            </PrivateRoute>
          } />

          <Route path="/tournaments/:id" element={<TournamentDetails />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;