import React, { useState } from 'react';
import { Alert, Button, CircularProgress } from '@mui/material';
import API_ROUTES, { apiRequest } from '../config/api';
import useCurrentUser from '../hooks/useCurrentUser';

/**
 * Aviso persistente para cuentas sin confirmar. Vive dentro de `NavBar`, así
 * que aparece en cualquier pantalla autenticada sin tener que acordarse de
 * agregarlo página por página. No bloquea nada por sí solo: el backend
 * (`requireVerifiedEmail`) es quien realmente gatea crear torneos y pagar.
 */
const EmailVerificationBanner = () => {
  const { user } = useCurrentUser();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setSending(true);
    setError('');
    try {
      await apiRequest(API_ROUTES.AUTH.RESEND_VERIFICATION, {
        method: 'POST',
        body: JSON.stringify({ email: user.email })
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos reenviar el enlace');
    } finally {
      setSending(false);
    }
  };

  return (
    <Alert
      severity="warning"
      sx={{ borderRadius: 0 }}
      action={
        !sent ? (
          <Button color="inherit" size="small" onClick={handleResend} disabled={sending}>
            {sending ? <CircularProgress size={18} color="inherit" /> : 'Reenviar enlace'}
          </Button>
        ) : undefined
      }
    >
      {sent
        ? 'Te mandamos un nuevo enlace de confirmación. Revisá tu casilla.'
        : 'Confirmá tu email para poder crear torneos y suscribirte a un plan.'}
      {error && ` — ${error}`}
    </Alert>
  );
};

export default EmailVerificationBanner;
