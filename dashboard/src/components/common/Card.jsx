import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const Card = ({
  children,
  title,
  subtitle,
  action,
  icon: Icon,
  className = '',
  hoverable = false,
  ...props
}) => {
  const { isDark } = useTheme();

  const themeStyles = isDark
    ? 'bg-obsidian-surface/90 border border-obsidian-border shadow-soft-float text-slate-100'
    : 'bg-warm-card border border-warm-border shadow-warm-card text-warm-text';

  const hoverStyles = hoverable
    ? 'hover:-translate-y-1 transition-all duration-300'
    : 'transition-colors duration-200';

  return (
    <div
      className={`rounded-2xl p-5 md:p-6 backdrop-blur-md ${themeStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {(title || action || Icon) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-inherit">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className={`p-2.5 rounded-xl ${isDark
                    ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                    : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
                  }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
              {subtitle && (
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;

