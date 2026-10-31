import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true, // Send HTTP-only auth cookies with every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor Attach optional Bearer token fallback from storage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('docintel_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor Format errors cleanly
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);


// EXPORTED API METHODS
export const authApi = {
  onboardSuperAdmin: (data) => api.post('/auth/onboard-super-admin', data),
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  getUsers: (params) => api.get('/auth/users', { params }),
  updateRole: (userId, role) => api.patch(`/auth/users/${userId}/role`, { role }),
};

export const clientApi = {
  listClients: () => api.get('/admin/clients'),
  onboardClient: (clientData) => api.post('/admin/clients/onboard', clientData),
  createClientUser: (clientId, userData) => api.post(`/admin/clients/${clientId}/users`, userData),
  createApiKey: (clientId, keyData) => api.post(`/admin/clients/${clientId}/api/keys`, keyData),
  getClientApiKeys: (clientId) => api.get(`/admin/clients/${clientId}/api/keys`),
};

export const documentApi = {
  upload: (formData, onProgress) =>
    api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    }),
  list: (params) => api.get('/documents', { params }),
  getStatus: (id) => api.get(`/documents/${id}/status`),
  getResults: (id) => api.get(`/documents/${id}/results`),
  applyCorrections: (id, updates) => api.patch(`/documents/${id}/corrections`, updates),
  reprocess: (id) => api.post(`/documents/${id}/reprocess`),
};

export const searchApi = {
  search: (params) => api.get('/search', { params }),
};

export default api;

