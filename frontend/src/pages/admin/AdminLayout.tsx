import React from 'react';
import { Container, Box, Paper, Tabs, Tab, Typography, Chip } from '@mui/material';
import {
  Insights as InsightsIcon,
  People as PeopleIcon,
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import useCurrentUser from '../../hooks/useCurrentUser';

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const TABS = [
  { label: 'Resumen', path: '/admin', icon: <InsightsIcon fontSize="small" /> },
  { label: 'Torneos', path: '/admin/tournaments', icon: <TrophyIcon fontSize="small" /> },
  { label: 'Usuarios', path: '/admin/users', icon: <PeopleIcon fontSize="small" />, superAdminOnly: true }
];

const AdminLayout = ({ title, subtitle, children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isSuperAdmin } = useCurrentUser();

  const visibleTabs = TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin);
  const activeIndex = visibleTabs.findIndex((tab) => tab.path === location.pathname);

  return (
    <Box>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h5" component="h1">
            {title}
          </Typography>
          {user && (
            <Chip
              size="small"
              label={user.role === 'superadmin' ? 'Superadmin' : 'Admin'}
              sx={{ bgcolor: '#D4AF37', color: '#000', fontWeight: 700 }}
            />
          )}
        </Box>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        )}

        <Paper elevation={3} sx={{ mb: 3 }}>
          <Tabs
            value={activeIndex === -1 ? false : activeIndex}
            onChange={(_, index) => navigate(visibleTabs[index].path)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {visibleTabs.map((tab) => (
              <Tab
                key={tab.path}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ minHeight: 56 }}
              />
            ))}
          </Tabs>
        </Paper>

        {children}
      </Container>
    </Box>
  );
};

export default AdminLayout;
