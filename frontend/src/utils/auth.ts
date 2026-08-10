/** Fuente única de "hay sesión" en el cliente. No es reactivo a propósito:
 *  se lee en render, igual que hacía `PrivateRoute` a mano. Login escribe
 *  el token y navega; logout lo borra y navega — en ambos casos hay
 *  re-render de por medio. */
export const getStoredToken = (): string | null => localStorage.getItem('token');

export const isAuthenticated = (): boolean => Boolean(getStoredToken());
