import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import LogoUploader from '../../components/LogoUploader';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser from '../../hooks/useCurrentUser';
import { canManageLeague } from '../../utils/leaguePermissions';
import { LeagueListItem } from '../../types/league';
import { TeamFormationMode } from '../../types/tournament';

type TournamentType = 'grand-slam' | 'master-1000';
type TournamentFormat = 'duos' | 'trios';
type GuestDrawMode = 'grouped' | 'mixed';

interface TournamentForm {
  name: string;
  description: string;
  startDate: string;
  type: TournamentType;
  format: TournamentFormat;
  teamFormationMode: TeamFormationMode;
  guestDrawMode: GuestDrawMode;
  /** '' = sin liga. Solo lo puede setear un admin (ver `canManageLeague` en el backend). */
  league: string;
}

const isAuthError = (error: { response?: { status?: number }; message?: string }) =>
  error.response?.status === 401 ||
  error.response?.status === 403 ||
  !!error.message?.includes('token') ||
  !!error.message?.includes('autenticación');

const CreateTournament = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leagueParam = searchParams.get('league');
  const { user } = useCurrentUser();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<TournamentForm>({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    type: 'grand-slam',
    format: 'duos',
    teamFormationMode: 'user-formed',
    guestDrawMode: 'grouped',
    league: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // El logo no se puede subir todavía: el endpoint necesita el id del torneo,
  // que recién existe después del POST. Queda acá hasta entonces.
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
  // true cuando la liga vino fija por `?league=` y ya se validó: el campo
  // queda bloqueado para que no se pueda "destrabar" a otra liga.
  const [leagueLocked, setLeagueLocked] = useState(false);
  // El `?league=` apuntaba a una liga que no existe o que el usuario no
  // administra: se ignora la preselección y se avisa, en vez de mandar al
  // backend un valor que va a rechazar con 403.
  const [leagueParamWarning, setLeagueParamWarning] = useState(false);

  // Solo quien administra al menos una liga (admin, o creador de esa liga)
  // puede asignarla; para el resto el selector ni se pide. `LEAGUES.LIST` es
  // público, así que el fetch se hace igual y se filtra en cliente.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const allLeagues: LeagueListItem[] = await apiRequest(API_ROUTES.LEAGUES.LIST);
        const manageable = allLeagues.filter((l) => canManageLeague(user, l));
        setLeagues(manageable);

        if (leagueParam) {
          const match = manageable.find((l) => l._id === leagueParam);
          if (match) {
            setFormData((prev) => ({ ...prev, league: match._id }));
            setLeagueLocked(true);
          } else {
            setLeagueParamWarning(true);
          }
        }
      } catch {
        // Si falla, el selector de liga simplemente no aparece; no es un
        // paso bloqueante para crear el torneo.
      }
    })();
  }, [user, leagueParam]);

  const steps = ['Información del torneo', 'Vista previa'];

  const handleLogoChange = (blob: Blob | null) => {
    setLogoBlob(blob);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blob ? URL.createObjectURL(blob) : null;
    });
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.name.trim()) {
        setError('Por favor ingresá un nombre para el torneo');
        return;
      }
      if (!formData.startDate) {
        setError('Por favor elegí una fecha de inicio');
        return;
      }
    }
    setError('');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const created = await apiRequest(API_ROUTES.TOURNAMENTS.CREATE, {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          type: formData.type,
          format: formData.format,
          teamFormationMode: formData.teamFormationMode,
          guestDrawMode: formData.guestDrawMode,
          ...(formData.league ? { league: formData.league } : {})
        })
      });

      // El torneo ya existe. Si el logo falla acá, sería absurdo tratarlo como
      // un error total y dejar al usuario en el formulario creyendo que no se
      // creó nada: se avisa en el detalle y desde ahí puede reintentar.
      if (logoBlob) {
        try {
          const logoData = new FormData();
          logoData.append('logo', logoBlob, 'logo.webp');
          await apiRequest(API_ROUTES.TOURNAMENTS.LOGO_UPLOAD(created._id), {
            method: 'PUT',
            body: logoData
          });
        } catch {
          navigate(`/tournaments/${created._id}`, {
            state: {
              message:
                'El torneo se creó, pero el logo no se pudo subir. Podés agregarlo desde acá.'
            }
          });
          return;
        }
      }

      navigate(`/tournaments/${created._id}`);
    } catch (err) {
      const e = err as { response?: { status?: number }; message?: string };
      if (isAuthError(e)) {
        localStorage.removeItem('token');
        navigate('/login', {
          state: { message: 'Tu sesión expiró. Iniciá sesión nuevamente.' }
        });
        return;
      }
      setError(e.message || 'Error al crear el torneo');
    } finally {
      setLoading(false);
    }
  };

  const formationDescription =
    formData.teamFormationMode === 'user-formed'
      ? 'Cada usuario inscribe su equipo armado (con compañeros elegidos por el).'
      : formData.teamFormationMode === 'creator-formed'
      ? 'Cada usuario se inscribe individualmente; cuando se completa el cupo, vos armás los equipos a mano.'
      : 'Cada usuario se inscribe individualmente; los equipos se sortean al iniciar.';

  const guestDrawDescription =
    formData.guestDrawMode === 'grouped'
      ? 'Los invitados se agrupan entre ellos: los primeros equipos salen formados solo por invitados.'
      : 'Los invitados entran al sorteo general y pueden quedar en cualquier equipo junto a jugadores registrados.';

  const targetParticipants =
    formData.teamFormationMode !== 'user-formed'
      ? `${8 * (formData.format === 'duos' ? 2 : 3)} jugadores individuales`
      : '8 equipos';

  return (
    <Box>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Crear nuevo torneo
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {leagueParamWarning && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLeagueParamWarning(false)}>
              No se pudo preseleccionar la liga indicada: no existe o no tenés permisos para
              administrarla. Podés elegir otra desde el selector, o dejar el torneo sin liga.
            </Alert>
          )}

          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 2 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <form onSubmit={handleSubmit}>
            {activeStep === 0 && (
              <Box>
                <TextField
                  fullWidth
                  label="Nombre del torneo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Descripción"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  multiline
                  rows={3}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Fecha de inicio"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                  required
                  margin="normal"
                />

                {leagues.length > 0 && (
                  <TextField
                    fullWidth
                    select
                    label="Liga (opcional)"
                    value={formData.league}
                    onChange={(e) => setFormData({ ...formData, league: e.target.value })}
                    margin="normal"
                    disabled={leagueLocked}
                    helperText={leagueLocked ? 'El torneo se va a crear dentro de esta liga' : undefined}
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
                    onChange={handleLogoChange}
                    label="Logo del torneo (opcional)"
                  />
                </Box>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Tipo de torneo (sistema de puntos)
                  </Typography>
                  <ToggleButtonGroup
                    color="primary"
                    exclusive
                    value={formData.type}
                    onChange={(_, value) =>
                      value && setFormData({ ...formData, type: value })
                    }
                  >
                    <ToggleButton value="grand-slam">Grand Slam</ToggleButton>
                    <ToggleButton value="master-1000">Master 1000</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formData.type === 'grand-slam'
                      ? 'Puntos: 25/18/15/10/8/4/2/1'
                      : 'Puntos: 12/9/7/5/4/2/1/0'}
                  </Typography>
                </Box>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Formato
                  </Typography>
                  <ToggleButtonGroup
                    color="primary"
                    exclusive
                    value={formData.format}
                    onChange={(_, value) =>
                      value && setFormData({ ...formData, format: value })
                    }
                  >
                    <ToggleButton value="duos">Duos (2 jugadores)</ToggleButton>
                    <ToggleButton value="trios">Tríos (3 jugadores)</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Cómo se forman los equipos
                  </Typography>
                  <ToggleButtonGroup
                    color="primary"
                    exclusive
                    value={formData.teamFormationMode}
                    onChange={(_, value) =>
                      value && setFormData({ ...formData, teamFormationMode: value })
                    }
                    sx={{ flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', sm: 'auto' } }}
                  >
                    <ToggleButton value="user-formed">
                      Equipos armados por jugadores
                    </ToggleButton>
                    <ToggleButton value="random">
                      Equipos aleatorios
                    </ToggleButton>
                    <ToggleButton value="creator-formed">
                      Equipos armados por el creador
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formationDescription}
                  </Typography>
                </Box>

                {formData.teamFormationMode === 'random' && (
                  <Box sx={{ my: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Invitados en el sorteo
                    </Typography>
                    <ToggleButtonGroup
                      color="primary"
                      exclusive
                      value={formData.guestDrawMode}
                      onChange={(_, value) =>
                        value && setFormData({ ...formData, guestDrawMode: value })
                      }
                    >
                      <ToggleButton value="grouped">
                        Agrupados entre ellos
                      </ToggleButton>
                      <ToggleButton value="mixed">
                        Mezclados con todos
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {guestDrawDescription}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>Vista previa</Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  {logoPreview && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                      <Avatar
                        variant="rounded"
                        src={logoPreview}
                        alt="Logo del torneo"
                        sx={{ width: 96, height: 96 }}
                      />
                    </Box>
                  )}
                  <Typography><b>Nombre:</b> {formData.name}</Typography>
                  {formData.description && (
                    <Typography><b>Descripción:</b> {formData.description}</Typography>
                  )}
                  <Typography>
                    <b>Fecha:</b> {new Date(formData.startDate).toLocaleDateString()}
                  </Typography>
                  <Typography>
                    <b>Tipo:</b>{' '}
                    {formData.type === 'grand-slam' ? 'Grand Slam' : 'Master 1000'}
                  </Typography>
                  <Typography>
                    <b>Formato:</b> {formData.format === 'duos' ? 'Duos' : 'Tríos'}
                  </Typography>
                  <Typography>
                    <b>Formación de equipos:</b>{' '}
                    {formData.teamFormationMode === 'user-formed'
                      ? 'Armados por jugadores'
                      : formData.teamFormationMode === 'creator-formed'
                      ? 'Armados por el creador'
                      : 'Aleatorios'}
                  </Typography>
                  {formData.league && (
                    <Typography>
                      <b>Liga:</b>{' '}
                      {leagues.find((l) => l._id === formData.league)?.name || formData.league}
                    </Typography>
                  )}
                  {formData.teamFormationMode === 'random' && (
                    <Typography>
                      <b>Invitados en el sorteo:</b>{' '}
                      {formData.guestDrawMode === 'grouped'
                        ? 'Agrupados entre ellos'
                        : 'Mezclados con todos'}
                    </Typography>
                  )}
                </Paper>
                <Alert severity="info">
                  El torneo quedará abierto a inscripciones. Esperá a que se completen
                  los cupos ({targetParticipants}) y desde la vista del torneo vas a
                  poder iniciarlo.
                </Alert>
              </Box>
            )}

            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {activeStep > 0 && (
                <Button variant="outlined" onClick={handleBack} disabled={loading}>
                  Atrás
                </Button>
              )}
              {activeStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  Crear torneo
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext} disabled={loading}>
                  Siguiente
                </Button>
              )}
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default CreateTournament;
