import React from 'react';
import { Menu, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from '../common/Badge';

export const Header = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const headerTheme = isDark
    ? 'bg-obsidian-bg/80 border-b border-obsidian-border text-slate-100 backdrop-blur-md'
    : 'bg-warm-bg/90 border-b border-warm-border text-warm-text backdrop-blur-md';

  return (
    <header className={`sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 h-20 transition-colors duration-200 ${headerTheme}`}>
      {/* Mobile Menu Toggle & System Info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          type="button"
          className={`p-2 rounded-xl lg:hidden ${
            isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slateGray-700 hover:bg-slateGray-100'
          }`}
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${isDark ? 'text-cyanBrand' : 'text-orangeBrand'}`} />
          <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
            {user?.role ? user.role.replace('_', ' ') : 'Guest'} Environment
          </span>
        </div>
      </div>

      {/* Quick Actions & Profile */}
      <div className="flex items-center gap-3">
        {/* Quick Search Shortcut */}
        <a
          href="/search"
          className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
            isDark
              ? 'bg-obsidian-surface border-obsidian-border text-slate-400 hover:text-white hover:border-cyanBrand/50'
              : 'bg-white border-warm-border text-slateGray-500 hover:text-slateGray-900 hover:border-orangeBrand/50 shadow-sm'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick Hybrid Search</span>
          <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slateGray-100 text-slateGray-600'}`}>
            /search
          </kbd>
        </a>

        {/* Dual-Mood Switcher Button */}
        <ThemeToggle />

        {/* User Role Badge */}
        {user && (
          <div className="hidden sm:block">
            <Badge status={user.role} size="md" />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

