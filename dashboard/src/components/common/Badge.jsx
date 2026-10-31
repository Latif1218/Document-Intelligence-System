import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  status,
  size = 'md',
  dot = true,
  className = '',
}) => {
  // Map document statuses or roles to visual styles
  let badgeStyles = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  let dotColor = 'bg-slate-400';

  const normalized = (status || variant).toLowerCase();

  if (['completed', 'success', 'active'].includes(normalized)) {
    badgeStyles = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    dotColor = 'bg-emerald-500';
  } else if (['needs_review', 'warning', 'flagged'].includes(normalized)) {
    badgeStyles = 'bg-amber-500/10 text-amber-500 border-amber-500/30';
    dotColor = 'bg-amber-500';
  } else if (['processing', 'queued', 'pending'].includes(normalized)) {
    badgeStyles = 'bg-sky-500/10 text-sky-500 border-sky-500/30';
    dotColor = 'bg-sky-500 animate-pulse';
  } else if (['failed', 'error', 'danger', 'inactive'].includes(normalized)) {
    badgeStyles = 'bg-rose-500/10 text-rose-500 border-rose-500/30';
    dotColor = 'bg-rose-500';
  } else if (['super_admin', 'super admin'].includes(normalized)) {
    badgeStyles = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    dotColor = 'bg-purple-400';
  } else if (['client_admin', 'client admin'].includes(normalized)) {
    badgeStyles = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    dotColor = 'bg-indigo-400';
  } else if (['client_viewer', 'client viewer'].includes(normalized)) {
    badgeStyles = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    dotColor = 'bg-slate-400';
  }

  const sizes = {
    sm: 'text-[10px] py-0.5 px-2 gap-1',
    md: 'text-xs py-1 px-2.5 gap-1.5',
    lg: 'text-sm py-1.5 px-3 gap-2',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizes[size]} ${badgeStyles} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
      <span className="capitalize">{children || status || variant}</span>
    </span>
  );
};

export default Badge;

