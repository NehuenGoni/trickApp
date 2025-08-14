import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import API_ROUTES, { apiRequest } from '../config/api';
import {
  Person as PersonIcon,
  EmojiEvents as TrophyIcon,
  Timeline as StatsIcon,
  Dashboard as DashboardIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';

interface NavBarProps {
  showBackButton?: boolean;
}

interface MenuItemWithPath {
  icon: React.ReactElement;
  label: string;
  path: string;
  action?: never;
  divider?: never;
}

interface MenuItemWithAction {
  icon: React.ReactElement;
  label: string;
  path?: never;
  action: () => void;
  divider?: never;
}

interface MenuItemDivider {
  divider: true;
  icon?: never;
  label?: never;
  path?: never;
  action?: never;
}

type MenuItem = MenuItemWithPath | MenuItemWithAction | MenuItemDivider;

const NavBar = ({ showBackButton = false }: NavBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const data = await apiRequest(API_ROUTES.AUTH.PROFILE);
      setUsername(data.user.username);
    } catch (err) {
      console.error('Error al cargar los datos del usuario');
    }
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNavigation = (path: string) => {
    handleClose();
    navigate(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const getInitials = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const menuItems: MenuItem[] = [
    { icon: <DashboardIcon fontSize="small" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <PersonIcon fontSize="small" />, label: 'Mi Perfil', path: '/profile' },
    { icon: <StatsIcon fontSize="small" />, label: 'Mis Estadísticas', path: '/stats' },
    { icon: <TrophyIcon fontSize="small" />, label: 'Mis Logros', path: '/achievements' },
    { divider: true },
    { icon: <LogoutIcon fontSize="small" />, label: 'Cerrar Sesión', action: handleLogout }
  ];

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1,
            cursor: 'pointer'
          }}
          onClick={() => navigate('/dashboard')}
        >
          TrickApp
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {username}
          </Typography>
          <IconButton
            size="large"
            aria-label="cuenta del usuario"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
          <Avatar sx={{ width: 32, height: 32 }}>
            {getInitials(username)}
          </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            {menuItems.map((item, index) => (
              item.divider ? (
                <Divider key={`divider-${index}`} />
              ) : (
                <MenuItem 
                  key={item.label}
                  onClick={() => {
                    handleClose();
                    if ('action' in item && item.action) {
                      item.action();
                    } else if ('path' in item && item.path) {
                      navigate(item.path);
                    }
                  }}
                  selected={'path' in item ? location.pathname === item.path : false}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  {item.icon}
                  {item.label}
                </MenuItem>
              )
            ))}
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default NavBar; 