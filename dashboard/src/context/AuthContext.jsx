import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('docintel_token') || null);
  const [loading, setLoading] = useState(true);

  // Check current session from cookie / token on mount
  const checkAuth = useCallback(async () => {
    try {
      const response = await authApi.getMe();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      localStorage.removeItem('docintel_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login handler
  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    if (response.success && response.data) {
      setUser(response.data.user);
      if (response.data.token) {
        setToken(response.data.token);
        localStorage.setItem('docintel_token', response.data.token);
      }
    }
    return response;
  };

  // One-time Super Admin Onboarding handler
  const onboardSuperAdmin = async (adminData) => {
    const response = await authApi.onboardSuperAdmin(adminData);
    if (response.success && response.data) {
      setUser(response.data.user);
      if (response.data.token) {
        setToken(response.data.token);
        localStorage.setItem('docintel_token', response.data.token);
      }
    }
    return response;
  };

  // Logout handler
  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('docintel_token');
    }
  };

  // Role verification helpers
  const isSuperAdmin = user?.role === 'super_admin';
  const isClientAdmin = user?.role === 'client_admin';
  const isClientViewer = user?.role === 'client_viewer';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isSuperAdmin,
        isClientAdmin,
        isClientViewer,
        login,
        onboardSuperAdmin,
        logout,
        refreshUser: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

