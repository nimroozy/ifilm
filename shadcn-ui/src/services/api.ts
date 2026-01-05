import axios from 'axios';
import { sanitizeUrl } from '@/utils/urlSanitizer';

// Use relative path only - no absolute URLs
const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper function to sanitize URLs in response data
const sanitizeResponseUrls = (data: any): any => {
  if (!data) return data;
  
  if (typeof data === 'string') {
    // If it's a URL string, sanitize it
    if (data.startsWith('http://') || data.startsWith('https://')) {
      return sanitizeUrl(data);
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponseUrls(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize URL fields
      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('image') || key.toLowerCase().includes('poster') || key.toLowerCase().includes('backdrop') || key.toLowerCase().includes('thumbnail') || key.toLowerCase().includes('stream')) {
        sanitized[key] = sanitizeUrl(value as string);
      } else if (key === 'items' && Array.isArray(value)) {
        // Recursively sanitize items array
        sanitized[key] = value.map((item: any) => sanitizeResponseUrls(item));
      } else {
        sanitized[key] = sanitizeResponseUrls(value);
      }
    }
    return sanitized;
  }
  
  return data;
};

// Response interceptor to sanitize URLs and handle token refresh
api.interceptors.response.use(
  (response) => {
    // Sanitize URLs in response data (safety fallback)
    if (response.data) {
      response.data = sanitizeResponseUrls(response.data);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);