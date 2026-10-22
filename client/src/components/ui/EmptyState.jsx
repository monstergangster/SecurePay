import React from 'react';
import { ShieldCheck, Inbox, AlertTriangle, FileSearch } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = ShieldCheck,
  title = 'No active records',
  description = 'Everything is currently operating within expected security and risk parameters.',
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center py-14 px-4 text-center ${className}`}>
    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-inner">
      <Icon size={22} className="text-blue-700/90" />
    </div>
    <h3 className="text-sm font-semibold text-slate-800 mb-1">{title}</h3>
    {description && <p className="text-xs text-slate-600 max-w-sm mb-4 leading-relaxed">{description}</p>}
    {action}
  </div>
);

export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-100/60 border border-slate-200/40 rounded ${className}`} />
);

export const TableSkeleton = ({ rows = 6, cols = 5 }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton
            key={j}
            className={`h-5 ${
              j === 0 ? 'w-36' : j === cols - 1 ? 'w-24' : 'flex-1'
            }`}
          />
        ))}
      </div>
    ))}
  </div>
);
