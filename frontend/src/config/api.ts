export const API_BASE_URL = process.env.REACT_APP_API_URL

const API_ROUTES = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    PROFILE: `${API_BASE_URL}/auth/profile`,
    FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
    RESET_PASSWORD: (token: string) => `${API_BASE_URL}/auth/reset-password/${token}`,
    VERIFY_EMAIL: (token: string) => `${API_BASE_URL}/auth/verify-email/${token}`,
    RESEND_VERIFICATION: `${API_BASE_URL}/auth/resend-verification`,
    UNSUBSCRIBE: (token: string) => `${API_BASE_URL}/auth/unsubscribe/${token}`,
  },
  USERS: {
    LIST: `${API_BASE_URL}/users`,
    DETAIL: (id: string) => `${API_BASE_URL}/users/${id}`,
    STATS:  (id: string) => `${API_BASE_URL}/users/${id}/stats`,
    STATS_SUMMARY: (id: string) => `${API_BASE_URL}/users/${id}/stats/summary`,
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
    SUBSCRIPTIONS: `${API_BASE_URL}/admin/subscriptions`,
    USER_BILLING: (id: string) => `${API_BASE_URL}/admin/users/${id}/billing`,
    USER_SUBSCRIPTION: (id: string) => `${API_BASE_URL}/admin/users/${id}/subscription`,
    USER_PLAN: (id: string) => `${API_BASE_URL}/admin/users/${id}/plan`,
    PRICING: `${API_BASE_URL}/admin/pricing`,
  },
  BILLING: {
    ME: `${API_BASE_URL}/billing/me`,
    PRICING: `${API_BASE_URL}/billing/pricing`,
    HISTORY: `${API_BASE_URL}/billing/history`,
    CHECKOUT: `${API_BASE_URL}/billing/checkout`,
    CANCEL: `${API_BASE_URL}/billing/subscription/cancel`,
    SYNC: `${API_BASE_URL}/billing/subscription/sync`,
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
    // Requiere auth: solo las ligas que el usuario puede gestionar (dueño/organizer, o todas si es admin).
    MINE: `${API_BASE_URL}/leagues/mine`,
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
    // POST para agregar (body: { userId }), DELETE con el userId en la URL para quitar.
    ORGANIZERS: (id: string) => `${API_BASE_URL}/leagues/${id}/organizers`,
    ORGANIZER: (id: string, userId: string) => `${API_BASE_URL}/leagues/${id}/organizers/${userId}`,
  },
};

/**
 * El backend gatea la creación de torneos y ligas con 402, y manda el
 * detalle del plan y el uso en el body (ver `BILLING_GATE_MESSAGES` en
 * `tournament.controller.ts` y el gate de `createLeague`). Este error tipado
 * es lo que le permite a la UI abrir el diálogo de upgrade con ese dato
 * concreto, en vez de mostrar un toast rojo genérico indistinguible de
 * cualquier otro 4xx.
 */
export class PaymentRequiredError extends Error {
  reason?: string;
  plan?: string;
  usage?: { periodKey: string; tournamentsCreated: number; tournamentsTotal: number };
  /** Presentes solo en `reason: 'league_member_limit_reached'` — ver `services/leagueCapGate.ts` del backend. */
  limit?: number;
  current?: number;
  /** `false` cuando quien rebotó no es el dueño del plan: no tiene sentido ofrecerle upgrade. */
  canUpgrade?: boolean;

  constructor(
    message: string,
    data: {
      reason?: string;
      plan?: string;
      usage?: PaymentRequiredError['usage'];
      limit?: number;
      current?: number;
      canUpgrade?: boolean;
    }
  ) {
    super(message);
    this.name = 'PaymentRequiredError';
    this.reason = data.reason;
    this.plan = data.plan;
    this.usage = data.usage;
    this.limit = data.limit;
    this.current = data.current;
    this.canUpgrade = data.canUpgrade;
  }
}

/**
 * `POST /billing/checkout` responde así (409, `fallback: 'manual'`) cuando
 * MercadoPago no está configurado en el backend. Permite que la UI caiga al
 * diálogo de contacto manual en vez de mostrar un error genérico.
 */
export class CheckoutUnavailableError extends Error {
  fallback: string;

  constructor(message: string, fallback: string) {
    super(message);
    this.name = 'CheckoutUnavailableError';
    this.fallback = fallback;
  }
}

/**
 * `requireVerifiedEmail` (backend) responde así (403, `reason: 'email_not_verified'`)
 * cuando el usuario intenta crear un torneo o iniciar un checkout sin haber
 * confirmado su cuenta. Permite que la UI muestre el CTA de reenvío en vez de
 * un error genérico indistinguible de cualquier otro 403.
 */
export class EmailNotVerifiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailNotVerifiedError';
  }
}

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

      // 401 con token = sesión inválida o revocada (por ejemplo, tras un reset de
      // contraseña): ahí sí conviene mandar a /login. Pero en páginas públicas
      // (torneo/liga compartidos) se piden igual algunos datos "si hay sesión" —
      // por ejemplo `useCurrentUser` para saber si mostrar controles de admin — y
      // esas llamadas van sin token a propósito. Un 401 sin token no es una sesión
      // caída, es un visitante anónimo; no hay que sacarlo de la página.
      if ((errorMessage === "Token inválido" || response.status === 401) && token) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      if (response.status === 402) {
        throw new PaymentRequiredError(errorMessage, {
          reason: parsedData?.reason,
          plan: parsedData?.plan,
          usage: parsedData?.usage,
          limit: parsedData?.limit,
          current: parsedData?.current,
          canUpgrade: parsedData?.canUpgrade
        });
      }

      if (response.status === 403 && parsedData?.reason === 'email_not_verified') {
        throw new EmailNotVerifiedError(errorMessage);
      }

      if (parsedData?.fallback) {
        throw new CheckoutUnavailableError(errorMessage, parsedData.fallback);
      }

      throw new Error(errorMessage);
    }
    return parsedData;
  } catch (error) {
    throw error;
  }
};

export default API_ROUTES; 