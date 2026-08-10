import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasChunkError: boolean;
}

/** Con code splitting, una pestaña abierta desde antes de un deploy puede
 *  pedir un chunk hasheado que Vercel ya borró. Sin esto, esa navegación
 *  simplemente rompe con una pantalla en blanco. */
class ChunkErrorBoundary extends React.Component<Props, State> {
  state: State = { hasChunkError: false };

  static getDerivedStateFromError(error: unknown): State | null {
    const message = error instanceof Error ? error.message : String(error);
    if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(message)) {
      return { hasChunkError: true };
    }
    return null;
  }

  render() {
    if (this.state.hasChunkError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'background.default',
            px: 3,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6">Hay una versión nueva de TrickApp</Typography>
          <Typography variant="body2" color="text.secondary">
            Recargá la página para seguir.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Recargar
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;
