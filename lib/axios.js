import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ip } from './Domain';
const api = axios.create({
  baseURL: ip,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Request interceptor: attach token if available
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('token'); // Get token from storage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized! Maybe redirect to login.');
    }
    return Promise.reject(error);
  }
);

// NOTE: This won’t work in React Native unless you manage CSRF manually
export const initCsrf = async () => {
  try {
    await api.get('/sanctum/csrf-cookie');
  } catch (error) {
    console.warn('CSRF init failed (ignored on mobile):', error.message);
  }
};

export default api;
