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
      card: 'border-slate-800 bg-slate-900/90 hover:border-slate-700/80',
      iconBox: 'bg-slate-800/80 text-slate-300 border border-slate-700/50',
      valueColor: 'text-white',
    },
    danger: {
      card: 'border-red-900/50 bg-gradient-to-br from-red-950/30 to-slate-900/90 hover:border-red-800/70',
      iconBox: 'bg-red-950/60 text-red-400 border border-red-800/60',
      valueColor: 'text-red-300',
    },
    warning: {
      card: 'border-amber-900/40 bg-gradient-to-br from-amber-950/20 to-slate-900/90 hover:border-amber-800/60',
      iconBox: 'bg-amber-950/60 text-amber-400 border border-amber-800/60',
      valueColor: 'text-amber-300',
    },
    success: {
      card: 'border-emerald-900/40 bg-gradient-to-br from-emerald-950/20 to-slate-900/90 hover:border-emerald-800/60',
      iconBox: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60',
      valueColor: 'text-emerald-300',
    },
    intelligence: {
      card: 'border-cyan-900/40 bg-gradient-to-br from-cyan-950/25 to-slate-900/90 hover:border-cyan-800/60',
      iconBox: 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/60',
      valueColor: 'text-cyan-300',
    },
    purple: {
      card: 'border-purple-900/40 bg-gradient-to-br from-purple-950/25 to-slate-900/90 hover:border-purple-800/60',
      iconBox: 'bg-purple-950/60 text-purple-400 border border-purple-800/60',
      valueColor: 'text-purple-300',
    },
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`relative p-5 rounded-xl border backdrop-blur transition-all duration-200 shadow-sm ${style.card} ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
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
        <h3 className={`text-2xl lg:text-3xl font-extrabold tracking-tight font-mono ${style.valueColor}`}>
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
