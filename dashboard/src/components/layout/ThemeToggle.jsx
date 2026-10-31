import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';


export const ThemeToggle = ({ showLabel = true, className = '' }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${isDark ? 'Warm Studio' : 'Obsidian Cyan'} mode`}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 focus:outline-none select-none ${
        isDark
          ? 'bg-obsidian-card border border-obsidian-border text-slate-200 hover:border-cyanBrand/50 shadow-soft-float'
          : 'bg-white border border-warm-border text-warm-text hover:border-orangeBrand/50 shadow-warm-card'
      } ${className}`}
    >
      <div
        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-transform duration-300 ${
          isDark
            ? 'bg-cyanBrand/10 text-cyanBrand rotate-0'
            : 'bg-orangeBrand/10 text-orangeBrand rotate-180'
        }`}
      >
        {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </div>

      {showLabel && (
        <span className="hidden sm:inline">
          {isDark ? 'Obsidian Cyan' : 'Warm Studio'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;

