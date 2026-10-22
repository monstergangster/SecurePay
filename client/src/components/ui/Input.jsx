import { useId } from 'react';

const base = "w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-colors";
const err = "border-red-500 focus-visible:ring-red-500";
const ok = "border-slate-700 hover:border-slate-600";

export const Input = ({ label, error, id, className = '', ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">{label}</label>}
      <input id={inputId} aria-invalid={Boolean(error)} className={`${base} ${error ? err : ok} ${className}`} {...props} />
      {error && <p className="text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
};

export const Select = ({ label, error, children, id, className = '', ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">{label}</label>}
      <select id={inputId} aria-invalid={Boolean(error)} className={`${base} ${error ? err : ok} ${className}`} {...props}>{children}</select>
      {error && <p className="text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
};

export const Textarea = ({ label, error, id, className = '', ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">{label}</label>}
      <textarea id={inputId} aria-invalid={Boolean(error)} className={`${base} ${error ? err : ok} resize-none ${className}`} {...props} />
      {error && <p className="text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
};
