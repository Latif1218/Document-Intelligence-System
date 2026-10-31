import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { Layout } from './components/layout/Layout';
import { Button } from './components/common/Button';
import { Card } from './components/common/Card';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { OnboardSuperAdminPage } from './pages/auth/OnboardSuperAdminPage';
import { DashboardOverviewPage } from './pages/dashboard/DashboardOverviewPage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { SearchPage } from './pages/search/SearchPage';
import { ClientsPage } from './pages/clients/ClientsPage';
import { ApiKeysPage } from './pages/clients/ApiKeysPage';
import { UsersPage } from './pages/users/UsersPage';

import {
  Loader2,
  ShieldAlert,
  FileQuestion,
  Home,
  Sparkles,
} from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors ${
          isDark ? 'bg-obsidian-bg text-slate-100' : 'bg-warm-bg text-slateGray-900'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className={`w-10 h-10 animate-spin ${
              isDark ? 'text-cyanBrand' : 'text-orangeBrand'
            }`}
          />
          <p className="text-sm font-semibold tracking-wide animate-pulse">
            Authenticating session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};


const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};


const RoleGuard = ({ allowedRoles = [], children }) => {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();

  if (loading) return null;

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="py-12 flex justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Access Restricted</h2>
              <p
                className={`text-xs mt-1 ${
                  isDark ? 'text-slate-400' : 'text-slateGray-600'
                }`}
              >
                Your role ({user?.role?.replace('_', ' ').toUpperCase()}) does not have permission to view this section.
              </p>
            </div>
            <Link to="/" className="w-full">
              <Button variant="primary" className="w-full" icon={Home}>
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return children;
};


// [404 PAGE] Not Found View
const NotFoundPage = () => {
  const { isDark } = useTheme();

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
        isDark ? 'bg-obsidian-bg text-slate-100' : 'bg-warm-bg text-slateGray-900'
      }`}
    >
      <Card className="max-w-md w-full p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className={`p-4 rounded-2xl ${
              isDark
                ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
            }`}
          >
            <FileQuestion className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">404</h1>
            <p className="text-base font-semibold mt-1">Page Not Found</p>
            <p
              className={`text-xs mt-1.5 ${
                isDark ? 'text-slate-400' : 'text-slateGray-600'
              }`}
            >
              The page you are looking for does not exist or has been relocated.
            </p>
          </div>
          <Link to="/" className="w-full mt-2">
            <Button variant="primary" className="w-full" icon={Home}>
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};


// APP COMPONENT Application Router Root
export const App = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/onboard-super-admin"
        element={
          <PublicRoute>
            <OnboardSuperAdminPage />
          </PublicRoute>
        }
      />


      {/* Protected Master Shell Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Core Dashboard Overview */}
        <Route index element={<DashboardOverviewPage />} />

        {/* Financial Documents Management Hub */}
        <Route path="documents" element={<DocumentsPage />} />

        {/* Hybrid AI Search (FTS + pgvector) */}
        <Route path="search" element={<SearchPage />} />

        {/* Multi-Tenant Organizations (Super Admin Only) */}
        <Route
          path="clients"
          element={
            <RoleGuard allowedRoles={['super_admin']}>
              <ClientsPage />
            </RoleGuard>
          }
        />

        {/* API Ingestion Keys (Super Admin & Client Admin) */}
        <Route
          path="api-keys"
          element={
            <RoleGuard allowedRoles={['super_admin', 'client_admin']}>
              <ApiKeysPage />
            </RoleGuard>
          }
        />

        {/* User Directory & RBAC (Super Admin & Client Admin) */}
        <Route
          path="users"
          element={
            <RoleGuard allowedRoles={['super_admin', 'client_admin']}>
              <UsersPage />
            </RoleGuard>
          }
        />
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;

