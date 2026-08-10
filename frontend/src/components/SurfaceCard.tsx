import React from 'react';
import { Paper, PaperProps, Typography, SxProps, Theme } from '@mui/material';

export interface SurfaceCardProps extends Omit<PaperProps, 'title'> {
  /** Título dorado centrado que se renderiza antes de children. Omitilo si necesitás
   * otro contenido (p. ej. un logo) por encima del título. */
  title?: React.ReactNode;
  titleSx?: SxProps<Theme>;
}

/**
 * Card con el estilo firma de la app (borde dorado + sombra), usado hoy en
 * Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Unsubscribe y
 * CreateMatch. Antes estaba copy-pasteado a mano en cada uno de esos archivos.
 */
const SurfaceCard = React.forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ title, titleSx, children, sx, elevation = 6, ...rest }, ref) => (
    <Paper
      ref={ref}
      elevation={elevation}
      sx={{
        p: 4,
        bgcolor: 'background.paper',
        border: '1px solid #FFD700',
        borderRadius: 3,
        boxShadow: '0px 4px 12px rgba(0,0,0,0.4)',
        ...sx,
      }}
      {...rest}
    >
      {title && (
        <Typography
          variant="h5"
          align="center"
          sx={{ mb: 2, fontWeight: 700, color: '#FFD700', ...titleSx }}
        >
          {title}
        </Typography>
      )}
      {children}
    </Paper>
  )
);

SurfaceCard.displayName = 'SurfaceCard';

export default SurfaceCard;
