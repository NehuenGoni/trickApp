import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import useCurrentUser from '../hooks/useCurrentUser';

interface AdminRouteProps {
  children: React.ReactNode;
  /** Si es true, solo el superadmin puede entrar (gestión de usuarios). */
  superAdminOnly?: boolean;
}

const AdminRoute = ({ children, superAdminOnly = false }: AdminRouteProps) => {
  const token = localStorage.getItem('token');
  const { user, loading, isAdmin, isSuperAdmin } = useCurrentUser();

  if (!token) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const allowed = superAdminOnly ? isSuperAdmin : isAdmin;
  if (!user || !allowed) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
