import axios from 'axios';

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 60000,
});

request.interceptors.request.use(
  (config) => {
    // Try to get user token from localStorage first, fallback to API key
    const userToken = localStorage.getItem('xueding_token');
    const apiKey = import.meta.env.VITE_API_KEY || 'MySecretToken123';
    const token = userToken || apiKey;
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default request;
