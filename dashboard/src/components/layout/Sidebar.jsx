import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Files,
  Building2,
  KeyRound,
  Search,
  Users,
  LogOut,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Badge } from '../common/Badge';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, isSuperAdmin, isClientAdmin, logout } = useAuth();
  const { isDark } = useTheme();

  // Navigation Links definition
  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['super_admin', 'client_admin', 'client_viewer'],
    },
    {
      to: '/documents',
      label: 'Documents Hub',
      icon: Files,
      roles: ['super_admin', 'client_admin', 'client_viewer'],
    },
    {
      to: '/search',
      label: 'Hybrid AI Search',
      icon: Search,
      roles: ['super_admin', 'client_admin', 'client_viewer'],
    },
    {
      to: '/clients',
      label: 'Organizations',
      icon: Building2,
      roles: ['super_admin'],
    },
    {
      to: '/api-keys',
      label: 'API Keys',
      icon: KeyRound,
      roles: ['super_admin', 'client_admin'],
    },
    {
      to: '/users',
      label: 'User Management',
      icon: Users,
      roles: ['super_admin', 'client_admin'],
    },
  ];

  // Filter based on active user role
  const userRole = user?.role || 'client_viewer';
  const visibleLinks = navItems.filter((item) => item.roles.includes(userRole));

  const sidebarTheme = isDark
    ? 'bg-obsidian-surface border-r border-obsidian-border text-slate-200'
    : 'bg-white border-r border-warm-border text-warm-text shadow-sm';

  const linkBase =
    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 select-none';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${sidebarTheme} ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo Header */}
        <div>
          <div className="flex items-center gap-3 px-6 h-20 border-b border-inherit">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                isDark
                  ? 'bg-gradient-cyan-indigo text-white shadow-glow-cyan'
                  : 'bg-gradient-orange-warm text-white shadow-glow-orange'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-none">
                DocIntel <span className={isDark ? 'text-cyanBrand' : 'text-orangeBrand'}>AI</span>
              </h1>
              <p className={`text-[10px] uppercase font-semibold tracking-wider mt-1 ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
                Care Guide Enterprise
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5 overflow-y-auto">
            {visibleLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) => {
                    if (isActive) {
                      return `${linkBase} ${
                        isDark
                          ? 'bg-cyanBrand/10 text-cyanBrand font-semibold border border-cyanBrand/30 shadow-glow-cyan'
                          : 'bg-orangeBrand/10 text-orangeBrand font-semibold border border-orangeBrand/30 shadow-sm'
                      }`;
                    }
                    return `${linkBase} ${
                      isDark
                        ? 'text-slate-400 hover:text-white hover:bg-white/5'
                        : 'text-slateGray-600 hover:text-slateGray-900 hover:bg-slateGray-100'
                    }`;
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout Bottom Section */}
        <div className="p-4 border-t border-inherit">
          {user && (
            <div className={`p-3 rounded-xl mb-3 ${isDark ? 'bg-obsidian-card/70 border border-obsidian-border' : 'bg-slateGray-50 border border-warm-border'}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-xs font-semibold truncate max-w-[120px]">
                  {user.name || user.username}
                </p>
                <Badge status={user.role} size="sm" dot={false} />
              </div>
              <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
                {user.email}
              </p>
            </div>
          )}

          <button
            onClick={logout}
            type="button"
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 border ${
              isDark
                ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                : 'border-rose-300 text-rose-600 hover:bg-rose-50'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

