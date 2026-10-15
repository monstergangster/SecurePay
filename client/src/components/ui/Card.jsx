import React from 'react';

export const Card = ({ children, className = '', padding = true }) => (
  <div
    className={`bg-slate-900/80 border border-slate-800/90 rounded-2xl backdrop-blur-sm shadow-sm transition-all ${
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
  <h3 className={`text-sm font-semibold tracking-wide text-slate-200 ${className}`}>{children}</h3>
);
