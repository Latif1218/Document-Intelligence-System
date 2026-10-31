import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const Input = ({
  label,
  error,
  helperText,
  icon: Icon,
  rightElement,
  className = '',
  id,
  required,
  ...props
}) => {
  const { isDark } = useTheme();
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const themeInputStyles = isDark
    ? 'bg-obsidian-card/80 border-obsidian-border text-slate-100 placeholder-slate-500 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
    : 'bg-white border-warm-border text-warm-text placeholder-slateGray-400 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20';

  const errorStyles = error
    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
    : '';

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
            isDark ? 'text-slate-300' : 'text-slateGray-700'
          }`}
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          id={inputId}
          className={`w-full rounded-xl py-2.5 px-3.5 text-sm transition-all duration-200 border outline-none ${
            Icon ? 'pl-10' : ''
          } ${rightElement ? 'pr-10' : ''} ${themeInputStyles} ${errorStyles}`}
          required={required}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3.5 flex items-center">{rightElement}</div>
        )}
      </div>

      {error ? (
        <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slateGray-500'}`}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export default Input;

