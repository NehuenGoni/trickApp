import React, { useEffect, useState } from 'react';
import { Avatar, SxProps, Theme } from '@mui/material';
import API_ROUTES from '../config/api';
import { TournamentLogoSource } from '../types/tournament';
import { getInitials } from '../utils/text';

interface TournamentLogoProps {
  tournament?: TournamentLogoSource | null;
  /** Lado del cuadrado en píxeles. */
  size?: number;
  variant?: 'rounded' | 'circular' | 'square';
  sx?: SxProps<Theme>;
  /**
   * Arma la URL del binario a partir de `(id, version)`. Por defecto apunta al
   * logo de torneo; se overridea para otras entidades con el mismo esquema de
   * logo (por ejemplo ligas, vía `API_ROUTES.LEAGUES.LOGO`).
   */
  logoUrlBuilder?: (id: string, version: string) => string;
}

/**
 * Muestra el logo de la entidad (torneo, liga, etc.), o sus iniciales si
 * todavía no tiene uno.
 *
 * Los torneos creados antes de esta feature no traen el campo `logo`, así que
 * el fallback no es un caso de error: es el estado normal de buena parte de los
 * datos existentes.
 */
const TournamentLogo: React.FC<TournamentLogoProps> = ({
  tournament,
  size = 48,
  variant = 'rounded',
  sx,
  logoUrlBuilder = API_ROUTES.TOURNAMENTS.LOGO
}) => {
  const version = tournament?.logo?.version;
  const src =
    tournament?._id && version ? logoUrlBuilder(tournament._id, version) : undefined;

  // Si la imagen falla (borrada desde otra pestaña, red caída), se cae a las
  // iniciales en vez de dejar el ícono roto del browser.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <Avatar
      variant={variant}
      src={!failed ? src : undefined}
      alt={tournament?.name ? `Logo de ${tournament.name}` : 'Logo del torneo'}
      imgProps={{ loading: 'lazy', onError: () => setFailed(true) }}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        bgcolor: 'rgba(212,175,55,0.18)',
        color: '#D4AF37',
        border: '1px solid rgba(212,175,55,0.35)',
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        ...sx
      }}
    >
      {getInitials(tournament?.name ?? '')}
    </Avatar>
  );
};

export default TournamentLogo;
