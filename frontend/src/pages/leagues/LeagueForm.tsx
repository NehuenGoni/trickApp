import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import SurfaceCard from '../../components/SurfaceCard';
import LogoUploader from '../../components/LogoUploader';
import API_ROUTES, { apiRequest } from '../../config/api';
import { LeagueDetail, LeagueFormValues } from '../../types/league';
import { TournamentLogoMeta } from '../../types/tournament';

const toDateInput = (iso?: string) => (iso ? iso.split('T')[0] : '');

const emptyForm: LeagueFormValues = {
  name: '',
  description: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  isActive: true
};

/** Una sola página para crear y editar: son 5 campos, no amerita duplicar el archivo. */
const LeagueForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [form, setForm] = useState<LeagueFormValues>(emptyForm);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logo, setLogo] = useState<TournamentLogoMeta | null>(null);
  // La liga todavía no existe en modo creación: el Blob queda acá hasta que
  // el POST devuelva un id (mismo patrón que CreateTournament).
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!isEditMode) return;
    (async () => {
      try {
        const data: LeagueDetail = await apiRequest(API_ROUTES.LEAGUES.DETAIL(id!));
        setForm({
          name: data.league.name,
          description: data.league.description || '',
          startDate: toDateInput(data.league.startDate),
          endDate: toDateInput(data.league.endDate),
          isActive: data.league.isActive
        });
        setLogo(data.league.logo ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la liga');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!form.startDate) {
      setError('La fecha de inicio es obligatoria');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate || null,
        isActive: form.isActive
      };
      const result = isEditMode
        ? await apiRequest(API_ROUTES.LEAGUES.UPDATE(id!), {
            method: 'PUT',
            body: JSON.stringify(body)
          })
        : await apiRequest(API_ROUTES.LEAGUES.CREATE, {
            method: 'POST',
            body: JSON.stringify(body)
          });
      const leagueId = isEditMode ? id! : result._id;

      // La liga ya existe. Si el logo falla acá, no tiene sentido tratarlo
      // como un error total: se avisa en el detalle y se puede reintentar.
      if (!isEditMode && logoBlob) {
        try {
          const logoData = new FormData();
          logoData.append('logo', logoBlob, 'logo.webp');
          await apiRequest(API_ROUTES.LEAGUES.LOGO_UPLOAD(leagueId), {
            method: 'PUT',
            body: logoData
          });
        } catch {
          navigate(`/leagues/${leagueId}`, {
            state: { message: 'La liga se creó, pero el logo no se pudo subir. Podés agregarlo desde acá.' }
          });
          return;
        }
      }

      navigate(`/leagues/${leagueId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la liga');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="sm" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  return (
    <Box>
      <NavBar />
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <SurfaceCard sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom sx={{ color: '#FFD700', fontWeight: 700 }}>
            {isEditMode ? 'Editar liga' : 'Crear nueva liga'}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ mb: 3 }}>
            {isEditMode ? (
              <LogoUploader
                uploadUrl={API_ROUTES.LEAGUES.LOGO_UPLOAD(id!)}
                deleteUrl={API_ROUTES.LEAGUES.LOGO_DELETE(id!)}
                currentLogoUrl={
                  logo?.version ? API_ROUTES.LEAGUES.LOGO(id!, logo.version) : undefined
                }
                label="Logo de la liga"
                onUploaded={setLogo}
              />
            ) : (
              <LogoUploader
                onChange={setLogoBlob}
                label="Logo de la liga (opcional)"
              />
            )}
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Nombre de la liga"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Descripción"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              rows={3}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Fecha de inicio"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Fecha de fin (opcional)"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              margin="normal"
            />
            <FormControlLabel
              sx={{ mt: 1 }}
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
              }
              label="Liga activa"
            />

            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => navigate(-1)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : null}
              >
                {isEditMode ? 'Guardar cambios' : 'Crear liga'}
              </Button>
            </Box>
          </form>
        </SurfaceCard>
      </Container>
    </Box>
  );
};

export default LeagueForm;
