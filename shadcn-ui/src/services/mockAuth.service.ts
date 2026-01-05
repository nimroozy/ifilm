import { mockUser, mockAdminUser } from '@/data/mockMovies';
import { DemoLoginResponse } from '@/types/auth.types';

const DEMO_CREDENTIALS = {
  email: 'demo@ifilm.com',
  password: 'demo123',
};

const ADMIN_CREDENTIALS = {
  email: 'admin@ifilm.com',
  password: 'admin123',
};

const DEMO_TOKEN = 'demo_jwt_token_' + Date.now();

export const isDemoMode = (): boolean => {
  const token = localStorage.getItem('accessToken');
  return token?.startsWith('demo_jwt_token_') || false;
};

export const demoLogin = (email: string, password: string): DemoLoginResponse => {
  // Check admin credentials
  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    const accessToken = DEMO_TOKEN;
    const refreshToken = 'demo_refresh_token_' + Date.now();

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(mockAdminUser));
    localStorage.setItem('demoMode', 'true');

    return {
      success: true,
      data: {
        user: mockAdminUser,
        accessToken,
        refreshToken,
      },
    };
  }

  // Check regular user credentials
  if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
    const accessToken = DEMO_TOKEN;
    const refreshToken = 'demo_refresh_token_' + Date.now();

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('demoMode', 'true');

    return {
      success: true,
      data: {
        user: mockUser,
        accessToken,
        refreshToken,
      },
    };
  }

  return {
    success: false,
    error: 'Invalid demo credentials',
  };
};

export const exitDemoMode = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('demoMode');
};

export const getDemoCredentials = () => DEMO_CREDENTIALS;

export const getAdminCredentials = () => ADMIN_CREDENTIALS;