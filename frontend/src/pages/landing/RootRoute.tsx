import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../../utils/auth';
import Landing from './Landing';

/** `/` es doble propósito: marketing para el visitante frío, atajo al
 *  dashboard para el que ya tiene sesión. El usuario logueado nunca
 *  debería ver la página de ventas. */
const RootRoute = () => (isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Landing />);

export default RootRoute;
