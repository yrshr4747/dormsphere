import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// JWT interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dormsphere_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dormsphere_token');
      localStorage.removeItem('dormsphere_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
