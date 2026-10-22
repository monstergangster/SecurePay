import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export const MetricCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendDirection = 'neutral', // 'up' | 'down' | 'neutral'
  variant = 'default', // 'default' | 'danger' | 'warning' | 'success' | 'intelligence'
  action,
  className = '',
}) => {
  const variantStyles = {
    default: {
      card: 'border-slate-200 bg-white hover:border-slate-200',
      iconBox: 'bg-slate-100 text-slate-700 border border-slate-200',
      valueColor: 'text-slate-900',
    },
    danger: {
      card: 'border-red-200 bg-white hover:border-red-200',
      iconBox: 'bg-red-50 text-red-700 border border-red-200',
      valueColor: 'text-red-700',
    },
    warning: {
      card: 'border-amber-200 bg-white hover:border-amber-200',
      iconBox: 'bg-amber-50 text-amber-700 border border-amber-200',
      valueColor: 'text-amber-700',
    },
    success: {
      card: 'border-emerald-200 bg-white hover:border-emerald-200',
      iconBox: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      valueColor: 'text-emerald-700',
    },
    intelligence: {
      card: 'border-blue-200 bg-white hover:border-blue-200',
      iconBox: 'bg-blue-50 text-blue-700 border border-blue-200',
      valueColor: 'text-blue-700',
    },
    purple: {
      card: 'border-purple-200 bg-white hover:border-purple-200',
      iconBox: 'bg-purple-50 text-purple-700 border border-purple-200',
      valueColor: 'text-purple-700',
    },
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`relative p-4 sm:p-5 rounded-xl border transition-colors duration-150 ${style.card} ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <div className="flex items-center gap-2">
          {action}
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.iconBox}`}>
              <Icon size={16} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <h3 className={`text-2xl font-semibold tracking-tight ${style.valueColor}`}>
          {value ?? '—'}
        </h3>
        {trend && (
          <div
            className={`flex items-center text-xs font-medium px-1.5 py-0.5 rounded border ${
              trendDirection === 'up'
                ? 'text-red-700 bg-red-50 border-red-200'
                : trendDirection === 'down'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-slate-600 bg-slate-100/60 border-slate-200'
            }`}
          >
            {trendDirection === 'up' ? (
              <ArrowUpRight size={12} className="mr-0.5" />
            ) : trendDirection === 'down' ? (
              <ArrowDownRight size={12} className="mr-0.5" />
            ) : (
              <Minus size={12} className="mr-0.5" />
            )}
            <span>{trend}</span>
          </div>
        )}
      </div>

      {subtext && <p className="text-xs text-slate-500 mt-2 font-medium">{subtext}</p>}
    </div>
  );
};
