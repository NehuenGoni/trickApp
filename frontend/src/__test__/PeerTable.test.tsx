import { screen } from '@testing-library/react';
import PeerTable from '../components/stats/PeerTable';
import { renderWithTheme } from '../testUtils/renderWithTheme';
import { UserStatsPeerRow } from '../types/userStats';

const row: UserStatsPeerRow = {
  key: 'user:1',
  displayName: 'Ana',
  userId: '1',
  isGuest: false,
  played: 5,
  wins: 4,
  losses: 1,
  winRate: 0.8,
  pointsFor: 100,
  pointsAgainst: 60
};

describe('PeerTable', () => {
  test('sin filas, muestra el mensaje de estado vacío', () => {
    renderWithTheme(<PeerTable rows={[]} emptyMessage="Todavía no hay compañeros." />);

    expect(screen.getByText('Todavía no hay compañeros.')).toBeInTheDocument();
  });

  test('con filas, pinta cada compañero con su winRate formateado', () => {
    renderWithTheme(<PeerTable rows={[row]} emptyMessage="No debería verse" />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.queryByText('No debería verse')).not.toBeInTheDocument();
  });

  test('marca a los invitados con un chip', () => {
    renderWithTheme(<PeerTable rows={[{ ...row, isGuest: true, userId: null }]} emptyMessage="" />);

    expect(screen.getByText('invitado')).toBeInTheDocument();
  });
});
