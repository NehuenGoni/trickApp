
import React from 'react';

export const MemoryRouter = ({ children }: any) => <div>{children}</div>;
export const BrowserRouter = ({ children }: any) => <div>{children}</div>;
export const Routes = ({ children }: any) => <div>{children}</div>;
export const Route = ({ element }: any) => element;
export const Navigate = () => <div>Navigate</div>;
export const useNavigate = () => jest.fn();
export const useLocation = () => ({ pathname: '/' });
export const useParams = () => ({ id: '123' });
// Devuelve un URLSearchParams real (no mockeado) para que `.get(...)` funcione
// tal como en producción: los componentes que leen un query param (p.ej.
// CreateTournament con `?league=`) reciben simplemente "sin parámetro".
export const useSearchParams = (): [URLSearchParams, () => void] => [new URLSearchParams(), jest.fn()];


export default {
  MemoryRouter,
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
  useSearchParams
};