import React from 'react';

export const Card = ({ children, className = '', padding = true }) => (
  <div
    className={`bg-white border border-slate-200 rounded-xl shadow-sm transition-all ${
      padding ? 'p-5 lg:p-6' : ''
    } ${className}`}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = '' }) => (
  <div className={`flex items-center justify-between mb-4 pb-1 ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-sm font-semibold tracking-wide text-slate-800 ${className}`}>{children}</h3>
);
