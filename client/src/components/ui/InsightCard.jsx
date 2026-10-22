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
      border: 'border-blue-200 bg-blue-50',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      highlight: 'text-blue-700',
    },
    purple: {
      border: 'border-purple-200 bg-purple-50',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      highlight: 'text-purple-700',
    },
    amber: {
      border: 'border-amber-200 bg-amber-50',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      highlight: 'text-amber-700',
    },
    rose: {
      border: 'border-rose-200 bg-rose-50',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      highlight: 'text-rose-700',
    },
  };

  const style = variantStyles[variant] || variantStyles.cyan;

  return (
    <div className={`p-4 rounded-xl border backdrop-blur ${style.border} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold">{title}</p>
        {Icon && (
          <div className={`p-1.5 rounded-lg border ${style.badge}`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <p className={`text-xl font-bold font-mono tracking-tight ${style.highlight}`}>{highlight}</p>
      {subtitle && <p className="text-xs text-slate-600 mt-1 leading-snug">{subtitle}</p>}
    </div>
  );
};
