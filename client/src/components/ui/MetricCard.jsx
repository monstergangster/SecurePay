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
      card: 'border-slate-800 bg-slate-900 hover:border-slate-700',
      iconBox: 'bg-slate-800 text-slate-300 border border-slate-700',
      valueColor: 'text-slate-100',
    },
    danger: {
      card: 'border-red-900/60 bg-slate-900 hover:border-red-800',
      iconBox: 'bg-red-950 text-red-300 border border-red-900',
      valueColor: 'text-red-300',
    },
    warning: {
      card: 'border-amber-900/50 bg-slate-900 hover:border-amber-800',
      iconBox: 'bg-amber-950 text-amber-300 border border-amber-900',
      valueColor: 'text-amber-300',
    },
    success: {
      card: 'border-emerald-900/50 bg-slate-900 hover:border-emerald-800',
      iconBox: 'bg-emerald-950 text-emerald-300 border border-emerald-900',
      valueColor: 'text-emerald-300',
    },
    intelligence: {
      card: 'border-cyan-900/50 bg-slate-900 hover:border-cyan-800',
      iconBox: 'bg-cyan-950 text-cyan-300 border border-cyan-900',
      valueColor: 'text-cyan-300',
    },
    purple: {
      card: 'border-purple-900/50 bg-slate-900 hover:border-purple-800',
      iconBox: 'bg-purple-950 text-purple-300 border border-purple-900',
      valueColor: 'text-purple-300',
    },
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`relative p-4 sm:p-5 rounded-xl border transition-colors duration-150 ${style.card} ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-300">{title}</p>
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
                ? 'text-red-400 bg-red-950/40 border-red-800/40'
                : trendDirection === 'down'
                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                : 'text-slate-400 bg-slate-800/60 border-slate-700'
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
