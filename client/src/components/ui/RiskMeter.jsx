import React from 'react';
import { getRiskInfo } from './RiskBadge';

export const RiskMeter = ({ score, showLabels = true, className = '' }) => {
  const isAssessed = score !== null && score !== undefined && !isNaN(score);
  const numericScore = isAssessed ? Math.min(100, Math.max(0, Math.round(score))) : 0;
  const info = getRiskInfo(isAssessed ? numericScore : null);

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Horizontal segmented risk bar */}
      <div className="relative pt-3 pb-1">
        {/* Pointer indicator */}
        {isAssessed && (
          <div
            className="absolute top-0 -translate-x-1/2 transition-all duration-500 flex flex-col items-center"
            style={{ left: `${numericScore}%` }}
          >
            <div className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white border border-slate-200 text-slate-800 shadow">
              {numericScore}
            </div>
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-700" />
          </div>
        )}

        <div className="h-2.5 w-full bg-slate-100 rounded-full flex overflow-hidden p-0.5 gap-0.5">
          <div className="h-full bg-emerald-500/80 rounded-l-full" style={{ width: '25%' }} title="Low: 0-24" />
          <div className="h-full bg-amber-500/80" style={{ width: '30%' }} title="Medium: 25-54" />
          <div className="h-full bg-orange-500/80" style={{ width: '25%' }} title="High: 55-79" />
          <div className="h-full bg-rose-500/80 rounded-r-full" style={{ width: '20%' }} title="Critical: 80-100" />
        </div>
      </div>

      {showLabels && (
        <div className="flex justify-between text-[11px] font-mono text-slate-500 uppercase tracking-wider">
          <span className="text-emerald-700/90 font-medium">Low 0-24</span>
          <span className="text-amber-700/90 font-medium">Med 25-54</span>
          <span className="text-orange-700/90 font-medium">High 55-79</span>
          <span className="text-rose-700/90 font-medium">Crit 80-100</span>
        </div>
      )}
    </div>
  );
};
