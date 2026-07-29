import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import logo from '../assets/logo.png';

interface AppLogoProps {
  size?: number;
  withText?: boolean;
  onClick?: () => void;
  sx?: SxProps<Theme>;
}

const AppLogo = ({ size = 32, withText = false, onClick, sx }: AppLogoProps) => {
  const image = (
    <Box
      component="img"
      src={logo}
      alt="TrickApp"
      sx={{
        height: size,
        width: 'auto',
        display: 'block',
        userSelect: 'none'
      }}
    />
  );

  if (!withText) {
    return (
      <Box
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        sx={{
          display: 'inline-flex',
          cursor: onClick ? 'pointer' : undefined,
          ...sx
        }}
      >
        {image}
      </Box>
    );
  }

  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        cursor: onClick ? 'pointer' : undefined,
        ...sx
      }}
    >
      {image}
      <Typography variant="h6" component="span">
        TrickApp
      </Typography>
    </Box>
  );
};

export default AppLogo;
