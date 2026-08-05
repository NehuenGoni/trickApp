import React, { useEffect, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  InputAdornment
} from '@mui/material';
import AdminLayout from './AdminLayout';
import API_ROUTES, { apiRequest } from '../../config/api';
import { PLAN_DEFINITIONS, arsPrice, formatArs } from '../../config/plans';
import { clearPricingCache } from '../../hooks/usePricing';

const AdminPricing = () => {
  const [usdToArs, setUsdToArs] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiRequest(API_ROUTES.ADMIN.PRICING)
      .then((data) => {
        setUsdToArs(data.usdToArs);
        setInput(String(data.usdToArs));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el tipo de cambio'))
      .finally(() => setLoading(false));
  }, []);

  const previewRate = Number(input);
  const previewValid = Number.isFinite(previewRate) && previewRate > 0;

  const handleSave = async () => {
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0) {
      setError('El tipo de cambio debe ser un número mayor a 0');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.PRICING, {
        method: 'PUT',
        body: JSON.stringify({ usdToArs: value })
      });
      setUsdToArs(data.usdToArs);
      setSuccess('Tipo de cambio actualizado. La página de planes lo va a reflejar en menos de un minuto.');
      clearPricingCache();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el tipo de cambio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Precios"
      subtitle="Un solo tipo de cambio USD → ARS convierte los precios de todos los planes en /planes."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField
              label="Tipo de cambio (USD → ARS)"
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">1 USD =</InputAdornment>
              }}
              sx={{ minWidth: 220 }}
            />
            <Button variant="contained" onClick={handleSave} disabled={saving || !previewValid} sx={{ mt: 1 }}>
              Guardar
            </Button>
            {usdToArs !== null && (
              <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                Valor actual en uso: 1 USD = {formatArs(usdToArs)}
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="subtitle1" gutterBottom>
          Vista previa
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Así se ven los planes con el valor que estás por guardar.
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Plan</TableCell>
                <TableCell align="right">Mensual (USD)</TableCell>
                <TableCell align="right">Mensual (ARS)</TableCell>
                <TableCell align="right">Anual (USD)</TableCell>
                <TableCell align="right">Anual (ARS)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PLAN_DEFINITIONS.filter((p) => p.priceUsdMonthly !== null).map((p) => {
                const yearlyUsd = p.priceUsdYearly ?? p.priceUsdMonthly! * 12;
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.label}</TableCell>
                    <TableCell align="right">USD {p.priceUsdMonthly}</TableCell>
                    <TableCell align="right">
                      {previewValid ? formatArs(arsPrice(p.priceUsdMonthly!, previewRate)) : '—'}
                    </TableCell>
                    <TableCell align="right">USD {yearlyUsd}</TableCell>
                    <TableCell align="right">
                      {previewValid ? formatArs(arsPrice(yearlyUsd, previewRate)) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </AdminLayout>
  );
};

export default AdminPricing;
