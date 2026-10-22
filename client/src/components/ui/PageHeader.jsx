import React from 'react';

export const PageHeader = ({ title, description, actions, className = '' }) => (
  <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">{actions}</div>}
  </div>
);
