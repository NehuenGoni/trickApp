export const API_BASE_URL = process.env.REACT_APP_API_URL

const API_ROUTES = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    PROFILE: `${API_BASE_URL}/auth/profile`,
    FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
    RESET_PASSWORD: (token: string) => `${API_BASE_URL}/auth/reset-password/${token}`,
  },
  USERS: {
    LIST: `${API_BASE_URL}/users`,
    DETAIL: (id: string) => `${API_BASE_URL}/users/${id}`,
    STATS:  (id: any) => `${API_BASE_URL}/users/${id}/stats`,
    MATCHESLENGTH: (id: any) => `${API_BASE_URL}/users/${id}/matches-length`,
    GETNAMES: (id: any) => `${API_BASE_URL}/users/matchesNames/${id}`,
    SEARCH: (query: string) => `${API_BASE_URL}/users/search?query=${query}`,
  },
  MATCHES: {
    CREATE: `${API_BASE_URL}/matches`,
    LIST: `${API_BASE_URL}/matches`,
    LIST_IN_PROGRESS: `${API_BASE_URL}/matches/in-progress`,
    GET: (id: string) => `${API_BASE_URL}/matches/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/matches/${id}`,
    UPDATE_SCORE: (id: string) => `${API_BASE_URL}/matches/${id}/score`,
    DELETE: (id: string) => `${API_BASE_URL}/matches/${id}`,
    GET_BY_TOURNAMENT: (tournamentId: string) => `${API_BASE_URL}/matches/tournament/${tournamentId}`
  },
  TOURNAMENTS: {
    CREATE: `${API_BASE_URL}/tournaments`,
    LIST: `${API_BASE_URL}/tournaments`,
    OPEN: `${API_BASE_URL}/tournaments/open`,
    GET: (id: string) => `${API_BASE_URL}/tournaments/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/tournaments/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/tournaments/${id}`,
    ADD_TEAM: (id: string) => `${API_BASE_URL}/tournaments/${id}/teams`,
    REMOVE_TEAM: (id: string, teamId: string) => `${API_BASE_URL}/tournaments/${id}/teams/${teamId}`,
    DRAW: (id: string) => `${API_BASE_URL}/tournaments/${id}/draw`,
    START: (id: string) => `${API_BASE_URL}/tournaments/${id}/start`,
    REGISTER: (id: string) => `${API_BASE_URL}/tournaments/${id}/register`,
    ADD_GUEST_TEAM: (id: string) => `${API_BASE_URL}/tournaments/${id}/teams/guests`,
    LEADERBOARD: (id: string) => `${API_BASE_URL}/tournaments/${id}/leaderboard`,
    LIVE: (id: string, since?: string) =>
      `${API_BASE_URL}/tournaments/${id}/live${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    SIGNUP_ADMIN: (id: string) => `${API_BASE_URL}/tournaments/${id}/signups/admin`,
    SIGNUP_ADMIN_REMOVE: (id: string, signupId: string) => `${API_BASE_URL}/tournaments/${id}/signups/admin/${signupId}`,
    ROSTER: (id: string) => `${API_BASE_URL}/tournaments/${id}/roster`,
    // El `version` va como query param para invalidar el cache del browser:
    // el endpoint responde con `Cache-Control: immutable`, así que la única
    // forma de que refetchee una imagen nueva es que cambie la URL.
    LOGO: (id: string, version?: string) =>
      `${API_BASE_URL}/tournaments/${id}/logo${version ? `?v=${encodeURIComponent(version)}` : ''}`,
    LOGO_UPLOAD: (id: string) => `${API_BASE_URL}/tournaments/${id}/logo`,
    LOGO_DELETE: (id: string) => `${API_BASE_URL}/tournaments/${id}/logo`,
  },
  ADMIN: {
    STATS: `${API_BASE_URL}/admin/stats`,
    USERS: `${API_BASE_URL}/admin/users`,
    USER: (id: string) => `${API_BASE_URL}/admin/users/${id}`,
    USER_PASSWORD: (id: string) => `${API_BASE_URL}/admin/users/${id}/password`,
    USER_POINTS: (id: string) => `${API_BASE_URL}/admin/users/${id}/points`,
    TOURNAMENTS: `${API_BASE_URL}/admin/tournaments`,
    TOURNAMENT: (id: string) => `${API_BASE_URL}/admin/tournaments/${id}`,
    TOURNAMENT_RESET: (id: string) => `${API_BASE_URL}/admin/tournaments/${id}/reset`,
    TOURNAMENT_CLOSE: (id: string) => `${API_BASE_URL}/admin/tournaments/${id}/close`,
    TOURNAMENT_RECALCULATE: (id: string) => `${API_BASE_URL}/admin/tournaments/${id}/recalculate`,
    TOURNAMENT_MATCHES: (id: string) => `${API_BASE_URL}/admin/tournaments/${id}/matches`,
    MATCH: (id: string) => `${API_BASE_URL}/admin/matches/${id}`,
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
    // Filtro de inactivas vía `apiRequest(LIST, { params: { includeInactive: 1 } })`.
    LIST: `${API_BASE_URL}/leagues`,
    DETAIL: (id: string) => `${API_BASE_URL}/leagues/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/leagues/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/leagues/${id}`,
    STANDINGS: (id: string) => `${API_BASE_URL}/leagues/${id}/standings`,
    // Sirve tanto para agregar (PUT) como para quitar (DELETE) un torneo de la liga.
    LEAGUE_TOURNAMENT: (id: string, tournamentId: string) =>
      `${API_BASE_URL}/leagues/${id}/tournaments/${tournamentId}`,
    // El `version` va como query param para invalidar el cache del browser, igual que en torneos.
    LOGO: (id: string, version?: string) =>
      `${API_BASE_URL}/leagues/${id}/logo${version ? `?v=${encodeURIComponent(version)}` : ''}`,
    LOGO_UPLOAD: (id: string) => `${API_BASE_URL}/leagues/${id}/logo`,
    LOGO_DELETE: (id: string) => `${API_BASE_URL}/leagues/${id}/logo`,
  },
};

export const apiRequest = async (url: string, options: RequestInit & { params?: Record<string, any> } = {}) => {
  const token = localStorage.getItem('token');
  
  // Construir URL con query parameters si existen
  let finalUrl = url;
  if (options.params) {
    const queryParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
    finalUrl = `${url}?${queryParams.toString()}`;
    delete (options as any).params;
  }
  
  // Con FormData el Content-Type lo pone el browser, porque incluye el boundary
  // que separa las partes del multipart. Forzarlo acá lo dejaría sin boundary y
  // el servidor no podría parsear el cuerpo.
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  try {
    const response = await fetch(finalUrl, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });
    
    const responseText = await response.text();

    const parsedData = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
      let errorMessage = `Error del servidor: ${response.status} ${response.statusText}`;
      
      if (parsedData?.message) {
        errorMessage = parsedData.message;
      }

      // 401 = sesión inválida o revocada (por ejemplo, tras un reset de contraseña).
      // 403 es falta de permisos: ahí la sesión sigue siendo válida y el error se muestra.
      if (errorMessage === "Token inválido" || response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      throw new Error(errorMessage);
    }
    return parsedData;
  } catch (error) {
    throw error;
  }
};

export default API_ROUTES; 