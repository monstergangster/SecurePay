import React from 'react';

export const getRiskInfo = (val) => {
  if (val === null || val === undefined) return { level: 'unassessed', label: 'Unassessed', bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700', dot: 'bg-slate-400' };
  
  if (typeof val === 'number') {
    if (val >= 80) return { level: 'critical', label: 'Critical', bg: 'bg-red-950/60', text: 'text-red-400', border: 'border-red-800/60', dot: 'bg-red-500' };
    if (val >= 55) return { level: 'high', label: 'High', bg: 'bg-orange-950/60', text: 'text-orange-400', border: 'border-orange-800/60', dot: 'bg-orange-500' };
    if (val >= 25) return { level: 'medium', label: 'Medium', bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60', dot: 'bg-amber-500' };
    return { level: 'low', label: 'Low', bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60', dot: 'bg-emerald-500' };
  }

  const norm = String(val).toLowerCase();
  switch (norm) {
    case 'critical':
      return { level: 'critical', label: 'Critical', bg: 'bg-red-950/60', text: 'text-red-400', border: 'border-red-800/60', dot: 'bg-red-500' };
    case 'high':
      return { level: 'high', label: 'High', bg: 'bg-orange-950/60', text: 'text-orange-400', border: 'border-orange-800/60', dot: 'bg-orange-500' };
    case 'medium':
      return { level: 'medium', label: 'Medium', bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60', dot: 'bg-amber-500' };
    case 'low':
      return { level: 'low', label: 'Low', bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60', dot: 'bg-emerald-500' };
    default:
      return { level: 'unassessed', label: norm || 'Unassessed', bg: 'bg-slate-800/80', text: 'text-slate-400', border: 'border-slate-700', dot: 'bg-slate-500' };
  }
};

export const RiskBadge = ({ level, score, showScore = false, className = '', size = 'md' }) => {
  const info = getRiskInfo(level ?? score);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-md border ${info.bg} ${info.text} ${info.border} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot} flex-shrink-0`} />
      <span>{info.label}</span>
      {showScore && score !== undefined && score !== null && (
        <span className="opacity-90 font-mono font-bold">({score})</span>
      )}
    </span>
  );
};
