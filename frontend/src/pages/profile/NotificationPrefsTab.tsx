import React, { useState } from 'react';
import { Paper, Typography, FormControlLabel, Switch, Alert, Box, Chip } from '@mui/material';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser, { clearCurrentUserCache, NotificationPrefs } from '../../hooks/useCurrentUser';

const PREF_ITEMS: Array<{ key: keyof NotificationPrefs; label: string; description: string; badge?: string }> = [
  {
    key: 'tournamentSignup',
    label: 'Inscripción confirmada',
    description: 'Cuando te inscribís (o te inscriben) a un torneo.'
  },
  {
    key: 'tournamentStart',
    label: 'Inicio de torneo',
    description: 'Con quién jugás y quién es tu primer rival.'
  },
  {
    key: 'matchResults',
    label: 'Resultado de cada partido',
    description: 'Un mail por cada partido que jugás dentro de un torneo.',
    badge: 'Alto volumen'
  },
  {
    key: 'tournamentResults',
    label: 'Resultados finales de torneo',
    description: 'Tu posición final y los puntos que sumaste.'
  },
  {
    key: 'leagueRoles',
    label: 'Organizador de liga',
    description: 'Cuando te designan organizador de una liga.'
  }
];

const NotificationPrefsTab = () => {
  const { user, loading } = useCurrentUser();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [savingKey, setSavingKey] = useState<keyof NotificationPrefs | null>(null);
  const [error, setError] = useState('');

  // `user` llega async del hook (cacheado o recién fetcheado): se sincroniza acá
  // en vez de leer `user.notificationPrefs` directo, para poder reflejar el
  // toggle al instante sin esperar el round-trip del PUT.
  const current = prefs ?? user?.notificationPrefs ?? null;

  const handleToggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!current) return;
    const next = { ...current, [key]: value };
    setPrefs(next);
    setSavingKey(key);
    setError('');
    try {
      await apiRequest(API_ROUTES.AUTH.PROFILE, {
        method: 'PUT',
        body: JSON.stringify({ notificationPrefs: { [key]: value } })
      });
      clearCurrentUserCache();
    } catch (err) {
      // Revierte el switch si el backend rechazó el cambio.
      setPrefs(current);
      setError(err instanceof Error ? err.message : 'No pudimos guardar el cambio');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading && !current) return null;

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 560, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>Notificaciones por email</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Los avisos de seguridad y pagos (verificación de cuenta, cambio de contraseña, cobros) se mandan siempre y no se pueden desactivar acá.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {current && PREF_ITEMS.map((item) => (
        <Box
          key={item.key}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            py: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            '&:last-of-type': { borderBottom: 'none' }
          }}
        >
          <Box sx={{ pr: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1">{item.label}</Typography>
              {item.badge && <Chip label={item.badge} size="small" color="warning" variant="outlined" />}
            </Box>
            <Typography variant="body2" color="text.secondary">{item.description}</Typography>
          </Box>
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Switch
                checked={current[item.key]}
                disabled={savingKey === item.key}
                onChange={(e) => handleToggle(item.key, e.target.checked)}
              />
            }
            label=""
          />
        </Box>
      ))}
    </Paper>
  );
};

export default NotificationPrefsTab;
