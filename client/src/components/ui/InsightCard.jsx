import React from 'react';

export const InsightCard = ({
  title,
  highlight,
  subtitle,
  icon: Icon,
  variant = 'cyan', // 'cyan' | 'purple' | 'amber' | 'rose'
  className = '',
}) => {
  const variantStyles = {
    cyan: {
      border: 'border-cyan-900/50 bg-gradient-to-br from-cyan-950/20 to-slate-900/90',
      badge: 'bg-cyan-950 text-cyan-400 border-cyan-800',
      highlight: 'text-cyan-300',
    },
    purple: {
      border: 'border-purple-900/50 bg-gradient-to-br from-purple-950/20 to-slate-900/90',
      badge: 'bg-purple-950 text-purple-400 border-purple-800',
      highlight: 'text-purple-300',
    },
    amber: {
      border: 'border-amber-900/50 bg-gradient-to-br from-amber-950/20 to-slate-900/90',
      badge: 'bg-amber-950 text-amber-400 border-amber-800',
      highlight: 'text-amber-300',
    },
    rose: {
      border: 'border-rose-900/50 bg-gradient-to-br from-rose-950/25 to-slate-900/90',
      badge: 'bg-rose-950 text-rose-400 border-rose-800',
      highlight: 'text-rose-300',
    },
  };

  const style = variantStyles[variant] || variantStyles.cyan;

  return (
    <div className={`p-4 rounded-xl border backdrop-blur ${style.border} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">{title}</p>
        {Icon && (
          <div className={`p-1.5 rounded-lg border ${style.badge}`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <p className={`text-xl font-bold font-mono tracking-tight ${style.highlight}`}>{highlight}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1 leading-snug">{subtitle}</p>}
    </div>
  );
};
