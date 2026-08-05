import React, { JSX } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme/theme';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/dashboard/Dashboard';
import Profile from './pages/profile/Profile';
import CreateMatch from './pages/matches/CreateMatch';
import Scoreboard from './pages/matches/Scoreboard';
import TournamentList from './pages/tournaments/TournamentList';
import CreateTournament from './pages/tournaments/CreateTournament';
import TournamentDetails from './pages/tournaments/TournamentDetails';
import LeagueList from './pages/leagues/LeagueList';
import LeagueForm from './pages/leagues/LeagueForm';
import LeagueDetails from './pages/leagues/LeagueDetails';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Stats from './pages/stats/Stats';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTournaments from './pages/admin/AdminTournaments';
import LiveTournament from './pages/live/LiveTournament';
import Plans from './pages/billing/Plans';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import AdminPricing from './pages/admin/AdminPricing';


function App(): JSX.Element {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
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

          <Route path="/stats" element={
            <PrivateRoute>
              <Stats />
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

          <Route path="/leagues" element={
            <PrivateRoute>
              <LeagueList />
            </PrivateRoute>
          } />

          <Route path="/leagues/create" element={
            <PrivateRoute>
              <LeagueForm />
            </PrivateRoute>
          } />

          <Route path="/leagues/:id/edit" element={
            <PrivateRoute>
              <LeagueForm />
            </PrivateRoute>
          } />

          {/* Sin guard, igual que /tournaments/:id: el GET es público y sirve para compartir la tabla. */}
          <Route path="/leagues/:id" element={<LeagueDetails />} />

          <Route path="/live/:tournamentId" element={<LiveTournament />} />

          {/* Público a propósito: es la grilla de precios, tiene que verse sin login. */}
          <Route path="/planes" element={<Plans />} />

          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />

          <Route path="/admin/tournaments" element={
            <AdminRoute>
              <AdminTournaments />
            </AdminRoute>
          } />

          <Route path="/admin/users" element={
            <AdminRoute superAdminOnly>
              <AdminUsers />
            </AdminRoute>
          } />

          <Route path="/admin/subscriptions" element={
            <AdminRoute superAdminOnly>
              <AdminSubscriptions />
            </AdminRoute>
          } />

          <Route path="/admin/pricing" element={
            <AdminRoute superAdminOnly>
              <AdminPricing />
            </AdminRoute>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;