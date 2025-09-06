
const API_ROUTES= {
    AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PROFILE: '/auth/profile',
    },
    USERS: {
    LIST: '/users',
    DETAIL: (id: string) => `/users/${id}`,
    STATS: '/users/stats',
    SEARCH: (query: string) => `/users/search?query=${query}`,
    },
    MATCHES: {
    CREATE: '/matches/create',
    LIST: '/matches',
    LIST_IN_PROGRESS: '/matches/in-progress',
    GET: (id: string) => `/matches/${id}`,
    UPDATE: (id: string) => `/matches/${id}`,
    DELETE: (id: string) => `/matches/${id}`,
    GET_BY_TOURNAMENT: (id: string) => `/matches/tournament/${id}`,
    },
    TOURNAMENTS: {
    CREATE: '/tournaments',
    LIST: '/tournaments',
    GET: (id: string) => `/tournaments/${id}`,
    UPDATE: (id: string) => `/tournaments/${id}`,
    DELETE: (id: string) => `/tournaments/${id}`,
    ADD_TEAM: (id: string) => `/tournaments/${id}/teams`,
    },
    TEAMS: {
    LIST: '/teams',
    CREATE: '/teams',
    DETAIL: (id: string) => `/teams/${id}`,
    UPDATE: (id: string) => `/teams/${id}`,
    DELETE: (id: string) => `/teams/${id}`,
    },
    LEAGUES: {
    LIST: '/leagues',
    CREATE: '/leagues',
    DETAIL: (id: string) => `/leagues/${id}`,
    UPDATE: (id: string) => `/leagues/${id}`,
    DELETE: (id: string) => `/leagues/${id}`,
    ADD_TOURNAMENT: '/leagues/add-tournament',
    UPDATE_POINTS: '/leagues/update-points',
    STANDINGS: (id: string) => `/leagues/${id}/standings`,
    },
}

const apiRequest= jest.fn((endpoint: string) => {
    console.log("mocked endpoint called:", endpoint);
    if (endpoint === '/auth/profile') {
    return Promise.resolve({
        user: { username: 'testuser', email: 'test@example.com' }
    });
    }
    if (endpoint === '/users') {
    return Promise.resolve([
        { id: '1', username: 'player1' },
        { id: '2', username: 'player2' },
    ]);
    }
    if (endpoint === '/tournaments') {
    return Promise.resolve([{ id: '123', name: 'Test Tournament', matches: [] }]);
    }
    if (endpoint === '/tournaments/123') {
    return Promise.resolve({ id: '123', name: 'Test Tournament', matches: [] });
    }
    if (endpoint === '/matches') {
    return Promise.resolve([]);
    }
    return Promise.resolve({});
})

export { API_ROUTES, apiRequest }
export default  API_ROUTES