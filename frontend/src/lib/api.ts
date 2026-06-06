import axios from 'axios';
import { Country, RouteSearchResult, CrawlJob } from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const searchRoute = async (
  origin: string,
  destination: string
): Promise<{ status: number; data: RouteSearchResult | CrawlJob }> => {
  const response = await api.get(`/routes/${origin}/${destination}`, {
    validateStatus: (status) => status === 200 || status === 202,
  });
  return { status: response.status, data: response.data };
};

export const pollJob = async (jobId: string): Promise<CrawlJob> => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export const getCountries = async (): Promise<Country[]> => {
  const response = await api.get('/countries');
  return response.data;
};

export const getExchangeRate = async (
  from: string,
  to: string
): Promise<{ rate: number; from: string; to: string }> => {
  const response = await api.get(`/exchange-rate?from=${from}&to=${to}`);
  return response.data;
};

export const login = async (
  email: string,
  password: string
): Promise<{ token: string; user: { email: string; full_name: string } }> => {
  const response = await api.post('/auth/login', { email, password });
  // Backend returns { access_token, user } — map to { token, user }
  return {
    token: response.data.access_token,
    user: response.data.user,
  };
};

export default api;
