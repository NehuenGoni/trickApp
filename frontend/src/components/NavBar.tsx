import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Button,
  Stack
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import useCurrentUser, { clearCurrentUserCache } from '../hooks/useCurrentUser';
import { clearManageableLeaguesCache } from '../hooks/useManageableLeagues';
import { getInitials } from '../utils/text';
import AppLogo from './AppLogo';
import EmailVerificationBanner from './EmailVerificationBanner';
import {
  Person as PersonIcon,
  EmojiEvents as TrophyIcon,
  Timeline as StatsIcon,
  Leaderboard as LeagueIcon,
  Dashboard as DashboardIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  Payments as PaymentsIcon
} from '@mui/icons-material';

type AppMenuItem = MenuItemWithPath | MenuItemWithAction | MenuItemDivider;

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



const NavBar = ({ showBackButton = false }: NavBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, isAdmin, loading } = useCurrentUser();
  const username = user?.username ?? '';

  // `NavBar` vive detrás de `PrivateRoute` en casi toda la app, pero también
  // se monta en páginas públicas (torneo/liga compartidos, `/planes`) donde
  // puede no haber sesión. Sin esto, un visitante anónimo veía el logo
  // apuntando a `/dashboard` (que lo rebotaba a `/login`, nunca a la
  // landing) y un menú de cuenta entero que no le servía para nada.
  const homeHref = user ? '/dashboard' : '/';

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    clearCurrentUserCache();
    clearManageableLeaguesCache();
    navigate('/login');
  };

  const menuItems: AppMenuItem[] = [
    { icon: <DashboardIcon fontSize="small" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <PersonIcon fontSize="small" />, label: 'Mi Perfil', path: '/profile' },
    { icon: <StatsIcon fontSize="small" />, label: 'Mis Estadísticas', path: '/stats' },
    { icon: <TrophyIcon fontSize="small" />, label: 'Mis Logros', path: '/achievements' },
    { icon: <LeagueIcon fontSize="small" />, label: 'Ligas', path: '/leagues' },
    { icon: <PaymentsIcon fontSize="small" />, label: 'Mi Plan', path: '/profile?tab=plan' },
    ...(isAdmin
      ? ([
          { divider: true },
          { icon: <AdminIcon fontSize="small" />, label: 'Panel Admin', path: '/admin' }
        ] as AppMenuItem[])
      : []),
    { divider: true },
    { icon: <LogoutIcon fontSize="small" />, label: 'Cerrar Sesión', action: handleLogout }
  ];

  return (
    <>
    <AppBar position="static">
      <Toolbar>
        <AppLogo
          size={32}
          withText
          onClick={() => navigate(homeHref)}
          sx={{ flexGrow: 1 }}
        />
        {user ? (
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
            <Avatar sx={{ width: 32, height: 32, border: '1.5px solid #FFD700', bgcolor: 'background.paper', color: '#FFD700', fontSize: '0.8rem', fontWeight: 700 }}>
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
        ) : !loading ? (
          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={() => navigate('/login')}>
              Iniciar sesión
            </Button>
            <Button variant="contained" size="small" onClick={() => navigate('/register')}>
              Crear cuenta gratis
            </Button>
          </Stack>
        ) : null}
      </Toolbar>
    </AppBar>
    <EmailVerificationBanner />
    </>
  );
};

export default NavBar; 