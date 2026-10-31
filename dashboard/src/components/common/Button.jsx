import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) => {
  const { isDark } = useTheme();

  // Size variations
  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
    md: 'px-4 py-2 text-sm font-semibold rounded-xl gap-2',
    lg: 'px-6 py-3 text-base font-semibold rounded-xl gap-2.5',
  };

  // Dual-mood variant definitions
  let variantStyles = '';

  if (variant === 'primary') {
    variantStyles = isDark
      ? 'bg-gradient-cyan-indigo text-white shadow-glow-cyan hover:brightness-110 active:scale-[0.98]'
      : 'bg-gradient-orange-warm text-white shadow-glow-orange hover:brightness-105 active:scale-[0.98]';
  } else if (variant === 'secondary') {
    variantStyles = isDark
      ? 'bg-obsidian-card text-slate-200 border border-obsidian-border hover:bg-slate-800'
      : 'bg-slateGray-100 text-slateGray-800 border border-slateGray-300 hover:bg-slateGray-200';
  } else if (variant === 'outline') {
    variantStyles = isDark
      ? 'border border-cyanBrand text-cyanBrand hover:bg-cyanBrand/10'
      : 'border border-orangeBrand text-orangeBrand hover:bg-orangeBrand/10';
  } else if (variant === 'danger') {
    variantStyles = 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 active:scale-[0.98]';
  } else if (variant === 'ghost') {
    variantStyles = isDark
      ? 'text-slate-400 hover:text-white hover:bg-white/5'
      : 'text-slateGray-600 hover:text-slateGray-900 hover:bg-slateGray-100';
  }

  const baseStyles = 'inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  return (
    <button
      className={`${baseStyles} ${sizes[size]} ${variantStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Please wait...</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;

