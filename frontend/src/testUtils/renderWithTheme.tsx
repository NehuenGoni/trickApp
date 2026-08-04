import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme/theme';

/**
 * Cualquier componente que use `useMediaQuery`/`useTheme` de MUI explota sin
 * un ThemeProvider en el árbol (fuera de tests, siempre hay uno en App.tsx).
 * Este helper lo replica para tests unitarios de componentes MUI aislados.
 */
export const renderWithTheme = (ui: React.ReactElement, options?: RenderOptions): RenderResult =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>, options);
