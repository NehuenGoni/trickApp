import React, { JSX, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
import theme from './theme/theme';

// Eager: la landing es el first paint del sitio y login/register son el
// destino inmediato de sus CTAs. Meterlos en un chunk aparte agregaría un
// round-trip justo donde más duele.
import RootRoute from './pages/landing/RootRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';

// Lazy: todo lo que solo ve un usuario con sesión, más el panel admin
// (que arrastra @mui/x-date-pickers) y la pantalla de TV.
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const Unsubscribe = lazy(() => import('./pages/auth/Unsubscribe'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const Stats = lazy(() => import('./pages/stats/Stats'));
const CreateMatch = lazy(() => import('./pages/matches/CreateMatch'));
const Scoreboard = lazy(() => import('./pages/matches/Scoreboard'));
const TournamentList = lazy(() => import('./pages/tournaments/TournamentList'));
const CreateTournament = lazy(() => import('./pages/tournaments/CreateTournament'));
const TournamentDetails = lazy(() => import('./pages/tournaments/TournamentDetails'));
const LeagueList = lazy(() => import('./pages/leagues/LeagueList'));
const LeagueForm = lazy(() => import('./pages/leagues/LeagueForm'));
const LeagueDetails = lazy(() => import('./pages/leagues/LeagueDetails'));
const LiveTournament = lazy(() => import('./pages/live/LiveTournament'));
const PublicExplore = lazy(() => import('./pages/explore/PublicExplore'));
const Plans = lazy(() => import('./pages/billing/Plans'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminTournaments = lazy(() => import('./pages/admin/AdminTournaments'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminPricing = lazy(() => import('./pages/admin/AdminPricing'));

/** Fondo verde paño, no blanco: sin esto hay un flash claro cada vez que
 *  cae en un chunk todavía no descargado. */
const RouteFallback = () => (
  <Box
    sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default'
    }}
  >
    <CircularProgress color="gold" />
  </Box>
);

function App(): JSX.Element {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <ChunkErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              <Route path="/unsubscribe/:token" element={<Unsubscribe />} />

              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />

              <Route
                path="/stats"
                element={
                  <PrivateRoute>
                    <Stats />
                  </PrivateRoute>
                }
              />

              <Route
                path="/matches/create"
                element={
                  <PrivateRoute>
                    <CreateMatch />
                  </PrivateRoute>
                }
              />

              <Route
                path="/matches/scoreboard/:matchId"
                element={
                  <PrivateRoute>
                    <Scoreboard />
                  </PrivateRoute>
                }
              />

              <Route
                path="/tournaments"
                element={
                  <PrivateRoute>
                    <TournamentList />
                  </PrivateRoute>
                }
              />

              <Route
                path="/tournaments/create"
                element={
                  <PrivateRoute>
                    <CreateTournament />
                  </PrivateRoute>
                }
              />

              <Route path="/tournaments/:id" element={<TournamentDetails />} />

              <Route
                path="/leagues"
                element={
                  <PrivateRoute>
                    <LeagueList />
                  </PrivateRoute>
                }
              />

              <Route
                path="/leagues/create"
                element={
                  <PrivateRoute>
                    <LeagueForm />
                  </PrivateRoute>
                }
              />

              <Route
                path="/leagues/:id/edit"
                element={
                  <PrivateRoute>
                    <LeagueForm />
                  </PrivateRoute>
                }
              />

              {/* Sin guard, igual que /tournaments/:id: el GET es público y sirve para compartir la tabla. */}
              <Route path="/leagues/:id" element={<LeagueDetails />} />

              <Route path="/live/:tournamentId" element={<LiveTournament />} />

              {/* Público a propósito: para que alguien sin cuenta pueda mirar qué hay en la app. */}
              <Route path="/explorar" element={<PublicExplore />} />

              {/* Público a propósito: es la grilla de precios, tiene que verse sin login. */}
              <Route path="/planes" element={<Plans />} />

              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/tournaments"
                element={
                  <AdminRoute>
                    <AdminTournaments />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <AdminRoute superAdminOnly>
                    <AdminUsers />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/subscriptions"
                element={
                  <AdminRoute superAdminOnly>
                    <AdminSubscriptions />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/pricing"
                element={
                  <AdminRoute superAdminOnly>
                    <AdminPricing />
                  </AdminRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ChunkErrorBoundary>
      </Router>
    </ThemeProvider>
  );
}

export default App;
