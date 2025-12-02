import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to add auth token automatically
axiosInstance.interceptors.request.use((config) => {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const token = currentUser?.token;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

export default axiosInstance;
