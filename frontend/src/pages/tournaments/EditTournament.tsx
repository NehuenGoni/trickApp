import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import SurfaceCard from '../../components/SurfaceCard';
import LogoUploader from '../../components/LogoUploader';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser from '../../hooks/useCurrentUser';
import { canManageLeague } from '../../utils/leaguePermissions';
import { toDateTimeLocalInput, fromDateTimeLocalInput } from '../../utils/dateInput';
import { LeagueListItem } from '../../types/league';
import { TeamFormationMode, TournamentLogoMeta } from '../../types/tournament';

type TournamentType = 'grand-slam' | 'master-1000';
type TournamentFormat = 'duos' | 'trios';
type GuestDrawMode = 'grouped' | 'mixed';

interface TournamentDetail {
  _id: string;
  name: string;
  description: string;
  startDate: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  type: TournamentType;
  format: TournamentFormat;
  teamFormationMode: TeamFormationMode;
  guestDrawMode: GuestDrawMode;
  teams: unknown[];
  individualSignups: unknown[];
  logo?: TournamentLogoMeta | null;
  league?: { _id: string; name: string } | null;
}

interface EditForm {
  name: string;
  description: string;
  /** Valor de un `datetime-local`, en hora local (ver `utils/dateInput.ts`). */
  startDate: string;
  type: TournamentType;
  format: TournamentFormat;
  teamFormationMode: TeamFormationMode;
  guestDrawMode: GuestDrawMode;
  league: string;
}

/**
 * Edición para el creador (u organizador) de un torneo. No comparte
 * componente con `CreateTournament`: ese trae un wizard de 2 pasos y el gate
 * de billing (`hasEstimatedSlot`), que no aplican acá — editar no consume
 * cupo del plan. Sigue en cambio el patrón de `LeagueForm` (fetch inicial,
 * `loading`/`saving`/`error`, logo subido aparte).
 */
const EditTournament = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useCurrentUser();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [logo, setLogo] = useState<TournamentLogoMeta | null>(null);
  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data: TournamentDetail = await apiRequest(API_ROUTES.TOURNAMENTS.GET(id));
        setTournament(data);
        setForm({
          name: data.name,
          description: data.description || '',
          startDate: toDateTimeLocalInput(data.startDate),
          type: data.type,
          format: data.format,
          teamFormationMode: data.teamFormationMode,
          guestDrawMode: data.guestDrawMode ?? 'grouped',
          league: data.league?._id || ''
        });
        setLogo(data.logo ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el torneo');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Mismo criterio que en CreateTournament: solo quien administra al menos
  // una liga puede (re)asignarla. `LEAGUES.LIST` es público, se filtra en cliente.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const allLeagues: LeagueListItem[] = await apiRequest(API_ROUTES.LEAGUES.LIST);
        setLeagues(allLeagues.filter((l) => canManageLeague(user, l)));
      } catch {
        // Si falla, el selector de liga simplemente no aparece.
      }
    })();
  }, [user]);

  // Espejo de la guarda del backend (`applyTournamentUpdate`): con equipos o
  // inscriptos cargados, cambiar el formato o la formación rompería el
  // tamaño/cupo ya comprometido.
  const hasParticipants =
    !!tournament && (tournament.teams.length > 0 || tournament.individualSignups.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !form) return;
    if (!form.name.trim()) {
      setError('Por favor ingresá un nombre para el torneo');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // El endpoint público solo deja editar mientras el torneo sigue
      // `upcoming`; el de admin no tiene esa restricción (mismo criterio que
      // ya usa `handleDelete` en TournamentList).
      const url = isAdmin ? API_ROUTES.ADMIN.TOURNAMENT(id) : API_ROUTES.TOURNAMENTS.UPDATE(id);
      await apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          startDate: fromDateTimeLocalInput(form.startDate),
          type: form.type,
          format: form.format,
          teamFormationMode: form.teamFormationMode,
          guestDrawMode: form.guestDrawMode,
          league: form.league || null
        })
      });
      navigate(`/tournaments/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el torneo');
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

  if (!tournament || !form) {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <Alert severity="error">{error || 'Torneo no encontrado'}</Alert>
        </Container>
      </Box>
    );
  }

  // El endpoint público rechaza cualquier edición fuera de `upcoming`: se
  // avisa acá en vez de dejar que el submit falle con un 400. Los admins no
  // pasan por esta restricción (usan el endpoint de admin al guardar).
  if (!isAdmin && tournament.status !== 'upcoming') {
    return (
      <Box>
        <NavBar />
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <SurfaceCard sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Este torneo ya no se puede editar
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Solo se puede modificar un torneo que todavía no comenzó.
            </Typography>
            <Button variant="contained" onClick={() => navigate(`/tournaments/${id}`)}>
              Volver al torneo
            </Button>
          </SurfaceCard>
        </Container>
      </Box>
    );
  }

  const formationDescription =
    form.teamFormationMode === 'user-formed'
      ? 'Cada usuario inscribe su equipo armado (con compañeros elegidos por él).'
      : form.teamFormationMode === 'creator-formed'
      ? 'Cada usuario se inscribe individualmente; cuando se completa el cupo, vos armás los equipos a mano.'
      : 'Cada usuario se inscribe individualmente; los equipos se sortean al iniciar.';

  const guestDrawDescription =
    form.guestDrawMode === 'grouped'
      ? 'Los invitados se agrupan entre ellos: los primeros equipos salen formados solo por invitados.'
      : 'Los invitados entran al sorteo general y pueden quedar en cualquier equipo junto a jugadores registrados.';

  const participantsLockedHint =
    'No se puede cambiar con equipos o inscriptos ya cargados en el torneo.';

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <SurfaceCard sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom sx={{ color: '#FFD700', fontWeight: 700 }}>
            Editar torneo
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Nombre del torneo"
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
              label="Fecha y hora de inicio"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
              margin="normal"
            />

            {leagues.length > 0 && (
              <TextField
                fullWidth
                select
                label="Liga (opcional)"
                value={form.league}
                onChange={(e) => setForm({ ...form, league: e.target.value })}
                margin="normal"
              >
                <MenuItem value="">Sin liga</MenuItem>
                {leagues.map((league) => (
                  <MenuItem key={league._id} value={league._id}>
                    {league.name}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Box sx={{ my: 3 }}>
              <LogoUploader
                uploadUrl={API_ROUTES.TOURNAMENTS.LOGO_UPLOAD(id!)}
                deleteUrl={API_ROUTES.TOURNAMENTS.LOGO_DELETE(id!)}
                currentLogoUrl={logo?.version ? API_ROUTES.TOURNAMENTS.LOGO(id!, logo.version) : undefined}
                label="Logo del torneo"
                onUploaded={setLogo}
              />
            </Box>

            <Box sx={{ my: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Tipo de torneo (sistema de puntos)
              </Typography>
              <ToggleButtonGroup
                color="gold"
                exclusive
                value={form.type}
                onChange={(_, value) => value && setForm({ ...form, type: value })}
              >
                <ToggleButton value="grand-slam">Grand Slam</ToggleButton>
                <ToggleButton value="master-1000">Master 1000</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" display="block">
                {form.type === 'grand-slam'
                  ? 'Puntos: 25/18/15/10/8/4/2/1'
                  : 'Puntos: 12/9/7/5/4/2/1/0'}
              </Typography>
            </Box>

            <Box sx={{ my: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Formato
              </Typography>
              <ToggleButtonGroup
                color="gold"
                exclusive
                value={form.format}
                onChange={(_, value) => value && setForm({ ...form, format: value })}
              >
                <ToggleButton value="duos" disabled={hasParticipants}>Duos (2 jugadores)</ToggleButton>
                <ToggleButton value="trios" disabled={hasParticipants}>Tríos (3 jugadores)</ToggleButton>
              </ToggleButtonGroup>
              {hasParticipants && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {participantsLockedHint}
                </Typography>
              )}
            </Box>

            <Box sx={{ my: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Cómo se forman los equipos
              </Typography>
              <ToggleButtonGroup
                color="gold"
                exclusive
                value={form.teamFormationMode}
                onChange={(_, value) => value && setForm({ ...form, teamFormationMode: value })}
                sx={{ flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', sm: 'auto' } }}
              >
                <ToggleButton value="user-formed" disabled={hasParticipants}>
                  Equipos armados por jugadores
                </ToggleButton>
                <ToggleButton value="random" disabled={hasParticipants}>
                  Equipos aleatorios
                </ToggleButton>
                <ToggleButton value="creator-formed" disabled={hasParticipants}>
                  Equipos armados por el creador
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" display="block">
                {hasParticipants ? participantsLockedHint : formationDescription}
              </Typography>
            </Box>

            {form.teamFormationMode === 'random' && (
              <Box sx={{ my: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Invitados en el sorteo
                </Typography>
                <ToggleButtonGroup
                  color="gold"
                  exclusive
                  value={form.guestDrawMode}
                  onChange={(_, value) => value && setForm({ ...form, guestDrawMode: value })}
                >
                  <ToggleButton value="grouped">Agrupados entre ellos</ToggleButton>
                  <ToggleButton value="mixed">Mezclados con todos</ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" display="block">
                  {guestDrawDescription}
                </Typography>
              </Box>
            )}

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
                Guardar cambios
              </Button>
            </Box>
          </form>
        </SurfaceCard>
      </Container>
    </Box>
  );
};

export default EditTournament;
