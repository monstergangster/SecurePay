const base = "w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors";
const err = "border-red-500 focus:ring-red-500";
const ok = "border-slate-700 hover:border-slate-600";

export const Input = ({ label, error, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-xs font-medium text-slate-400">{label}</label>}
    <input className={`${base} ${error ? err : ok} ${className}`} {...props} />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
);

export const Select = ({ label, error, children, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-xs font-medium text-slate-400">{label}</label>}
    <select className={`${base} ${error ? err : ok} ${className}`} {...props}>{children}</select>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
);

export const Textarea = ({ label, error, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-xs font-medium text-slate-400">{label}</label>}
    <textarea className={`${base} ${error ? err : ok} resize-none ${className}`} {...props} />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
);
