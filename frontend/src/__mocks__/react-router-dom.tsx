
import React from 'react';

export const MemoryRouter = ({ children }: any) => <div>{children}</div>;
export const BrowserRouter = ({ children }: any) => <div>{children}</div>;
export const Routes = ({ children }: any) => <div>{children}</div>;
export const Route = ({ element }: any) => element;
export const Navigate = () => <div>Navigate</div>;
export const useNavigate = () => jest.fn();
export const useLocation = () => ({ pathname: '/' });
export const useParams = () => ({ id: '123' });


export default {
  MemoryRouter,
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation
};