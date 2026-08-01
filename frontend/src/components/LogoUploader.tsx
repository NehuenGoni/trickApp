import React, { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, CircularProgress, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import { apiRequest } from '../config/api';
import { TournamentLogoMeta } from '../types/tournament';
import {
  ACCEPTED_IMAGE_TYPES,
  ImageResizeError,
  resizeToSquareWebp
} from '../utils/imageResize';

interface LogoUploaderProps {
  /**
   * En edición: el logo se sube apenas se elige el archivo, a `uploadUrl`
   * (PUT) / `deleteUrl` (DELETE).
   * En creación la entidad todavía no existe, así que se omiten y el Blob
   * queda en manos del padre hasta que haya un id (vía `onChange`).
   */
  uploadUrl?: string;
  deleteUrl?: string;
  /** Logo actual, para el preview inicial. */
  logo?: TournamentLogoMeta | null;
  /** URL ya armada del logo actual (requiere `logo.version` y el id de la entidad). */
  currentLogoUrl?: string;
  /** Se llama con el Blob procesado (creación) o con la metadata nueva (edición). */
  onChange?: (blob: Blob | null) => void;
  onUploaded?: (logo: TournamentLogoMeta | null) => void;
  size?: number;
  label?: string;
}

/** Subida de logo genérica: la usan torneos y ligas (mismo esquema de metadata). */
const LogoUploader: React.FC<LogoUploaderProps> = ({
  uploadUrl,
  deleteUrl,
  currentLogoUrl,
  onChange,
  onUploaded,
  size = 96,
  label = 'Logo'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

      if (uploadUrl) {
        const formData = new FormData();
        formData.append('logo', blob, 'logo.webp');
        const result = await apiRequest(uploadUrl, {
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

    if (!deleteUrl) {
      onChange?.(null);
      return;
    }

    setBusy(true);
    try {
      await apiRequest(deleteUrl, { method: 'DELETE' });
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

export default LogoUploader;
