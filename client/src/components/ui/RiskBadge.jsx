import React from 'react';

export const getRiskInfo = (val) => {
  if (val === null || val === undefined) return { level: 'unassessed', label: 'Unassessed', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
  
  if (typeof val === 'number') {
    if (val >= 80) return { level: 'critical', label: 'Critical', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    if (val >= 55) return { level: 'high', label: 'High', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' };
    if (val >= 25) return { level: 'medium', label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    return { level: 'low', label: 'Low', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
  }

  const norm = String(val).toLowerCase();
  switch (norm) {
    case 'critical':
      return { level: 'critical', label: 'Critical', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    case 'high':
      return { level: 'high', label: 'High', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' };
    case 'medium':
      return { level: 'medium', label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    case 'low':
      return { level: 'low', label: 'Low', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
    default:
      return { level: 'unassessed', label: norm || 'Unassessed', bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-500' };
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
