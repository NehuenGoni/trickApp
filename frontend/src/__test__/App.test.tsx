import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import App from '../App';

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.mock('../config/api');

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Error al cargar los usuarios')) return;
    if (typeof args[0] === 'string' && args[0].includes('Error fetching tournaments')) return;
    console.warn(...args); 
  });
});

jest.mock('../components/PrivateRoute', () => {
  const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
  };
  return PrivateRoute;
});

jest.mock('../pages/profile/Profile', () => {
  const Profile = () => (
    <div>Profile Component</div>
  );
  return Profile;
});

jest.mock('../pages/matches/CreateMatch', () => {
  const CreateMatch = () => (
    <div>Create Match Component</div>
  );
  return CreateMatch;
});

jest.mock('../pages/tournaments/TournamentList', () => {
  const TournamentList = () => (
    <div>
      <h1>Torneos</h1>
      <div>Tournament List Component</div>
    </div>
  );
  return TournamentList;
});

jest.mock('../pages/tournaments/TournamentDetails', () => {
  const TournamentDetails = () => (
    <div>Tournament Details Component</div>
  );
  return TournamentDetails;
});

jest.mock('../components/NavBar', () => {
  const NavBar = () => (
    <nav data-testid="navbar">
      <div>Navigation</div>
    </nav>
  );
  return NavBar;
});


const localStorageMock = (() => {
  let store: { [key: string]: string } = {
    'token': 'mock-token-123' 
  };
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

describe("App routing", () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

  });

  afterEach(() => {
    localStorageMock.clear();
    localStorageMock.setItem('token', 'mock-token-123');
    jest.restoreAllMocks();
  });

  test('fetch mock is working', async () => {
    const response = await fetch('http://localhost:5000/api/auth/profile');
    const data = await response.json();
    expect(data.user.username).toBe('testuser');
  });

  test("renders login page when navigating to /login", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Iniciar Sesión/i)).toBeInTheDocument();
  });

  test("renders register page when navigating to /register", async () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>
    );
    
    expect(await screen.findByText(/¿No tienes una cuenta\?/i)).toBeInTheDocument();
  });

  test("redirects / to /dashboard", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /¡Bienvenido a TrickApp!/i })).toBeInTheDocument();
  });

 test("renders tournaments list when navigating to /tournaments", async () => {
    render(
      <MemoryRouter initialEntries={["/tournaments"]}>
        <App />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Torneos/i })).toBeInTheDocument();
    });
  });

  test("renders tournament details when navigating to /tournaments/123", async () => {
    render(
      <MemoryRouter initialEntries={["/tournaments/123"]}>
        <App />
      </MemoryRouter>
    );
    
    expect(await screen.findByText(/Tournament Details Component/i)).toBeInTheDocument();
  });

  test('fetch mock is working correctly', async () => {
    const response = await fetch('http://localhost:5000/api/auth/profile');
    const data = await response.json();
    
    expect(data.user).toBeDefined();
    expect(data.user._id).toBe('user123');
    expect(data.user.username).toBe('testuser');
  });
});