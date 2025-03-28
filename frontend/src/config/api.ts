const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const API_ROUTES = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    PROFILE: `${API_BASE_URL}/auth/profile`,
  },
  USERS: {
    LIST: `${API_BASE_URL}/users`,
    DETAIL: (id: string) => `${API_BASE_URL}/users/${id}`,
    STATS: `${API_BASE_URL}/users/stats`,
    SEARCH: (query: string) => `${API_BASE_URL}/users/search?query=${query}`
  },
  MATCHES: {
    CREATE: `${API_BASE_URL}/matches`,
    LIST: `${API_BASE_URL}/matches`,
    LIST_IN_PROGRESS: `${API_BASE_URL}/matches/in-progress`,
    GET: (id: string) => `${API_BASE_URL}/matches/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/matches/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/matches/${id}`,
    GET_BY_TOURNAMENT: (tournamentId: string) => `${API_BASE_URL}/matches/tournament/${tournamentId}`
  },
  TOURNAMENTS: {
    CREATE: `${API_BASE_URL}/tournaments`,
    LIST: `${API_BASE_URL}/tournaments`,
    GET: (id: string) => `${API_BASE_URL}/tournaments/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/tournaments/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/tournaments/${id}`,
    ADD_TEAM: (id: string) => `${API_BASE_URL}/tournaments/${id}/teams`
  },
  TEAMS: {
    CREATE: `${API_BASE_URL}/teams`,
    LIST: `${API_BASE_URL}/teams`,
    DETAIL: (id: string) => `${API_BASE_URL}/teams/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/teams/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/teams/${id}`
  },
  LEAGUES: {
    CREATE: `${API_BASE_URL}/leagues`,
    LIST: `${API_BASE_URL}/leagues`,
    DETAIL: (id: string) => `${API_BASE_URL}/leagues/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/leagues/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/leagues/${id}`,
    ADD_TOURNAMENT: `${API_BASE_URL}/leagues/add-tournament`,
    UPDATE_POINTS: `${API_BASE_URL}/leagues/update-points`,
    STANDINGS: (id: string) => `${API_BASE_URL}/leagues/${id}/standings`,
  },
};

export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  console.log('🌐 API Request:', {
    url,
    method: options.method || 'GET',
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    body: options.body ? JSON.parse(options.body as string) : undefined
  });

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    console.log('📥 API Response Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error('❌ API Error Response:', responseText);
      
      try {
        const error = JSON.parse(responseText);
        throw new Error(error.message || 'Error en la solicitud');
      } catch (parseError) {
        console.error('❌ Error parsing response:', parseError);
        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    console.log('✅ API Response Data:', data);
    return data;
  } catch (error) {
    console.error('❌ API Request Error:', error);
    throw error;
  }
};

export default API_ROUTES; 