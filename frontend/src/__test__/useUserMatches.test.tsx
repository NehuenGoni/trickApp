import { renderHook, waitFor } from '@testing-library/react';
import { useUserMatches } from '../hooks/useUserMatches';
import { apiRequest } from '../config/api';

// Factory explícita en vez de `jest.mock('../config/api')` a secas: el mock
// manual de src/__mocks__/api.ts define USERS.STATS como un string, no una
// función, así que las rutas con parámetros (como STATS(id)) terminan
// automockeadas a `undefined` en vez de construir la URL real. Con la
// factory se controla exactamente lo que necesita este test.
jest.mock('../config/api', () => ({
  __esModule: true,
  apiRequest: jest.fn(),
  default: {
    USERS: {
      STATS: (id: string) => `/users/${id}/stats`
    }
  }
}));

const mockApiRequest = apiRequest as jest.Mock;

/**
 * Test directo de la regresión que tenía Stats.tsx: la paginación llamaba
 * fetchUserStats() justo después de setCurrentPage(value), cerrando sobre el
 * currentPage viejo (stale closure) y pidiendo siempre la misma página.
 * useUserMatches gobierna el fetch por las deps del efecto, así que un
 * cambio de `page` debe disparar un fetch nuevo con el `skip` correcto.
 */
describe('useUserMatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiRequest.mockResolvedValue({ matches: [], total: 0, skip: 0, limit: 10 });
  });

  test('dispara un fetch nuevo al cambiar de página', async () => {
    const { rerender } = renderHook(({ page }) => useUserMatches('user-1', page, 10), {
      initialProps: { page: 1 }
    });

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
    expect(mockApiRequest).toHaveBeenLastCalledWith(
      expect.stringContaining('/user-1/stats'),
      expect.objectContaining({ params: { skip: 0, limit: 10 } })
    );

    rerender({ page: 2 });

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(2));
    expect(mockApiRequest).toHaveBeenLastCalledWith(
      expect.stringContaining('/user-1/stats'),
      expect.objectContaining({ params: { skip: 10, limit: 10 } })
    );
  });
});
