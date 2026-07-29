import React, { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, CircularProgress, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import API_ROUTES, { apiRequest } from '../config/api';
import { TournamentLogoMeta } from '../types/tournament';
import {
  ACCEPTED_IMAGE_TYPES,
  ImageResizeError,
  resizeToSquareWebp
} from '../utils/imageResize';

interface TournamentLogoUploaderProps {
  /**
   * En edición: el logo se sube apenas se elige el archivo.
   * En creación el torneo todavía no existe, así que se omite y el Blob queda
   * en manos del padre hasta que haya un id.
   */
  tournamentId?: string;
  /** Logo actual, para el preview inicial. */
  logo?: TournamentLogoMeta | null;
  /** Se llama con el Blob procesado (creación) o con la metadata nueva (edición). */
  onChange?: (blob: Blob | null) => void;
  onUploaded?: (logo: TournamentLogoMeta | null) => void;
  size?: number;
  label?: string;
}

const TournamentLogoUploader: React.FC<TournamentLogoUploaderProps> = ({
  tournamentId,
  logo,
  onChange,
  onUploaded,
  size = 96,
  label = 'Logo del torneo'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentLogoUrl =
    tournamentId && logo?.version
      ? API_ROUTES.TOURNAMENTS.LOGO(tournamentId, logo.version)
      : undefined;

  // El object URL del preview local se revoca al reemplazarlo o al desmontar,
  // si no queda el Blob retenido en memoria.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después de un error.
    event.target.value = '';
    if (!file) return;

    setError('');
    setBusy(true);

    try {
      const blob = await resizeToSquareWebp(file);

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });

      if (tournamentId) {
        const formData = new FormData();
        formData.append('logo', blob, 'logo.webp');
        const result = await apiRequest(API_ROUTES.TOURNAMENTS.LOGO_UPLOAD(tournamentId), {
          method: 'PUT',
          body: formData
        });
        onUploaded?.(result?.logo ?? null);
      } else {
        onChange?.(blob);
      }
    } catch (err) {
      const message =
        err instanceof ImageResizeError
          ? err.message
          : (err as Error)?.message || 'No se pudo procesar la imagen';
      setError(message);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setError('');
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!tournamentId) {
      onChange?.(null);
      return;
    }

    setBusy(true);
    try {
      await apiRequest(API_ROUTES.TOURNAMENTS.LOGO_DELETE(tournamentId), { method: 'DELETE' });
      onUploaded?.(null);
    } catch (err) {
      setError((err as Error)?.message || 'No se pudo quitar el logo');
    } finally {
      setBusy(false);
    }
  };

  const displayUrl = previewUrl ?? currentLogoUrl;
  const hasLogo = !!displayUrl;

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        {label}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar
            variant="rounded"
            src={displayUrl}
            alt="Vista previa del logo"
            sx={{
              width: size,
              height: size,
              bgcolor: 'rgba(212,175,55,0.12)',
              border: '1px dashed rgba(212,175,55,0.45)'
            }}
          >
            <PhotoCameraIcon sx={{ color: 'rgba(212,175,55,0.7)' }} />
          </Avatar>
          {busy && (
            <CircularProgress
              size={size * 0.4}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                mt: `${-size * 0.2}px`,
                ml: `${-size * 0.2}px`
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhotoCameraIcon />}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {hasLogo ? 'Cambiar' : 'Subir logo'}
            </Button>
            {hasLogo && (
              <Button
                variant="text"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={busy}
                onClick={handleRemove}
              >
                Quitar
              </Button>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            WebP, PNG o JPG. Se recorta cuadrado y se optimiza automáticamente.
          </Typography>
        </Box>
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </Box>
  );
};

export default TournamentLogoUploader;
