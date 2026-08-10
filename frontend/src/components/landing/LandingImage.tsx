import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { GOLD } from './landingTokens';

interface LandingImageProps {
  src: string;
  alt: string;
  /** Dimensiones intrínsecas reales del archivo — reservan el espacio
   *  antes de la descarga y evitan CLS. */
  width: number;
  height: number;
  /** Solo la imagen del hero: carga eager + alta prioridad. */
  priority?: boolean;
  /** Marco dorado tipo SurfaceCard, para las capturas de producto. */
  framed?: boolean;
  sx?: SxProps<Theme>;
}

const LandingImage = ({ src, alt, width, height, priority = false, framed = false, sx }: LandingImageProps) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    width={width}
    height={height}
    loading={priority ? 'eager' : 'lazy'}
    decoding={priority ? 'sync' : 'async'}
    fetchPriority={priority ? 'high' : 'auto'}
    sx={{
      width: '100%',
      maxWidth: '100%',
      height: 'auto',
      aspectRatio: `${width} / ${height}`,
      display: 'block',
      borderRadius: framed ? 3 : 2,
      border: framed ? `1px solid ${alpha(GOLD, 0.35)}` : 'none',
      boxShadow: framed ? '0px 8px 28px rgba(0,0,0,0.5)' : 'none',
      ...sx
    }}
  />
);

export default LandingImage;
