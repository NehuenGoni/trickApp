import React, { useCallback, useEffect, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  MenuItem,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
  Casino as PointsIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import AdminLayout from './AdminLayout';
import API_ROUTES, { apiRequest } from '../../config/api';
import useCurrentUser, { clearCurrentUserCache, UserRole } from '../../hooks/useCurrentUser';

interface AdminUser {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  totalPoints: number;
  createdAt?: string;
}

const ROLE_LABEL: Record<UserRole, string> = {
  user: 'Jugador',
  admin: 'Admin',
  superadmin: 'Superadmin'
};

const ROLE_COLOR: Record<UserRole, string> = {
  user: '#546E7A',
  admin: '#4f49cd',
  superadmin: '#D4AF37'
};

const AdminUsers = () => {
  const { user: currentUser } = useCurrentUser();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ username: '', email: '', role: 'user' as UserRole });
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [pointsTarget, setPointsTarget] = useState<AdminUser | null>(null);
  const [pointsForm, setPointsForm] = useState({ mode: 'delta' as 'delta' | 'set', value: '', reason: '' });
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.USERS, {
        params: { page: page + 1, limit, search: debouncedSearch || undefined }
      });
      setUsers(data.users);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openEdit = (user: AdminUser) => {
    setEditTarget(user);
    setEditForm({ username: user.username, email: user.email, role: user.role });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiRequest(API_ROUTES.ADMIN.USER(editTarget._id), {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      // Si el admin se editó a sí mismo, el perfil cacheado quedó viejo.
      if (editTarget._id === currentUser?._id) clearCurrentUserCache();
      setSuccess(`Perfil de ${editForm.username} actualizado`);
      setEditTarget(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordTarget) return;
    setSaving(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.USER_PASSWORD(passwordTarget._id), {
        method: 'POST',
        body: JSON.stringify(newPassword ? { newPassword } : {})
      });
      if (data?.temporaryPassword) {
        setGeneratedPassword(data.temporaryPassword);
      } else {
        setSuccess(data?.message || 'Contraseña restablecida');
        setPasswordTarget(null);
      }
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustPoints = async () => {
    if (!pointsTarget) return;
    setSaving(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.USER_POINTS(pointsTarget._id), {
        method: 'POST',
        body: JSON.stringify({
          mode: pointsForm.mode,
          value: Number(pointsForm.value),
          reason: pointsForm.reason
        })
      });
      setSuccess(data?.message || 'Puntos actualizados');
      setPointsTarget(null);
      setPointsForm({ mode: 'delta', value: '', reason: '' });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ajustar los puntos');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const data = await apiRequest(API_ROUTES.ADMIN.USER(deleteTarget._id), { method: 'DELETE' });
      setSuccess(data?.message || 'Usuario eliminado');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Usuarios"
      subtitle="Editá perfiles, cambiá roles, restablecé contraseñas y corregí puntos."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : users.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No se encontraron usuarios.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell align="right">Puntos</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {user.username}
                        {user._id === currentUser?._id && (
                          <Chip size="small" label="vos" sx={{ ml: 1, height: 18 }} />
                        )}
                      </Typography>
                      {user.createdAt && (
                        <Typography variant="caption" color="text.secondary">
                          Desde {new Date(user.createdAt).toLocaleDateString('es-AR')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{user.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={ROLE_LABEL[user.role]}
                        sx={{ bgcolor: ROLE_COLOR[user.role], color: '#fff', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">{user.totalPoints}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Editar perfil">
                          <IconButton size="small" onClick={() => openEdit(user)} sx={{ color: '#4f49cd' }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Restablecer contraseña">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setPasswordTarget(user);
                              setNewPassword('');
                              setGeneratedPassword('');
                            }}
                            sx={{ color: '#D4AF37' }}
                          >
                            <KeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Ajustar puntos">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setPointsTarget(user);
                              setPointsForm({ mode: 'delta', value: '', reason: '' });
                            }}
                            sx={{ color: 'success.main' }}
                          >
                            <PointsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={user._id === currentUser?._id ? 'No podés eliminar tu cuenta' : 'Eliminar usuario'}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={user._id === currentUser?._id}
                              onClick={() => setDeleteTarget(user)}
                              sx={{ color: 'error.main' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={limit}
          onRowsPerPageChange={(e) => {
            setLimit(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Paper>

      {/* Editar perfil */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Editar perfil</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre de usuario"
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label="Rol"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              fullWidth
              helperText={
                editTarget?._id === currentUser?._id
                  ? 'No podés quitarte a vos mismo el rol de superadmin.'
                  : 'Admin gestiona torneos y partidos. Superadmin además gestiona usuarios.'
              }
            >
              <MenuItem value="user">Jugador</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="superadmin">Superadmin</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancelar</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={saving}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restablecer contraseña */}
      <Dialog
        open={!!passwordTarget}
        onClose={() => {
          setPasswordTarget(null);
          setGeneratedPassword('');
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Restablecer contraseña</DialogTitle>
        <DialogContent>
          {generatedPassword ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Contraseña temporal generada. Copiala ahora: no se vuelve a mostrar.
              </Alert>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1
                }}
              >
                <Typography sx={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                  {generatedPassword}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => navigator.clipboard?.writeText(generatedPassword)}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Paper>
            </>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Se cerrarán todas las sesiones activas de <strong>{passwordTarget?.username}</strong>.
                Dejá el campo vacío para generar una contraseña temporal.
              </DialogContentText>
              <TextField
                label="Nueva contraseña (opcional)"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                helperText="Mínimo 6 caracteres"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPasswordTarget(null);
              setGeneratedPassword('');
            }}
          >
            {generatedPassword ? 'Listo' : 'Cancelar'}
          </Button>
          {!generatedPassword && (
            <Button onClick={handleResetPassword} variant="contained" disabled={saving}>
              Restablecer
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Ajustar puntos */}
      <Dialog open={!!pointsTarget} onClose={() => setPointsTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Ajustar puntos</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {pointsTarget?.username} tiene <strong>{pointsTarget?.totalPoints}</strong> puntos.
          </DialogContentText>
          <Stack spacing={2}>
            <TextField
              select
              label="Operación"
              value={pointsForm.mode}
              onChange={(e) =>
                setPointsForm({ ...pointsForm, mode: e.target.value as 'delta' | 'set' })
              }
              fullWidth
            >
              <MenuItem value="delta">Sumar / restar</MenuItem>
              <MenuItem value="set">Fijar total</MenuItem>
            </TextField>
            <TextField
              label={pointsForm.mode === 'delta' ? 'Puntos a sumar (o negativo para restar)' : 'Nuevo total'}
              type="number"
              value={pointsForm.value}
              onChange={(e) => setPointsForm({ ...pointsForm, value: e.target.value })}
              fullWidth
            />
            <TextField
              label="Motivo"
              value={pointsForm.reason}
              onChange={(e) => setPointsForm({ ...pointsForm, reason: e.target.value })}
              fullWidth
              required
              helperText="Queda registrado en el historial del usuario"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPointsTarget(null)}>Cancelar</Button>
          <Button
            onClick={handleAdjustPoints}
            variant="contained"
            disabled={saving || !pointsForm.value || !pointsForm.reason.trim()}
          >
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Eliminar usuario */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Eliminar usuario</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar la cuenta de <strong>{deleteTarget?.username}</strong>? Se lo quitará de las
            inscripciones abiertas. El historial de partidos y torneos jugados se conserva. Esta
            acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={saving}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;
