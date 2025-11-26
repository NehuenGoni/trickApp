import '@testing-library/jest-dom';

process.env.REACT_APP_API_URL = 'http://localhost:5000/api';

global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
  // console.log('Mock fetch called with URL:', url);

  if (url.includes('/api/auth/profile')) {
    return Promise.resolve({
      json: () => Promise.resolve({ 
        user: { 
          _id: 'user123', 
          username: 'testuser', 
          email: 'test@example.com' 
        } 
      }),
      ok: true,
      status: 200,
    } as Response);
  }
  
  if (url.includes('/api/tournaments')) {
    return Promise.resolve({
      json: () => Promise.resolve([{ 
        id: '123', 
        name: 'Test Tournament',
        matches: [] 
      }]),
      ok: true,
      status: 200,
    } as Response);
  }
  
  if (url.includes('/api/tournaments/123')) {
    return Promise.resolve({
      json: () => Promise.resolve({
        id: '123',
        name: 'Test Tournament',
        matches: []
      }),
      ok: true,
      status: 200,
    } as Response);
  }
  
  return Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200,
  } as Response);
});
})