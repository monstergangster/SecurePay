const v = {
  primary: 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-transparent',
  danger: 'bg-red-700 hover:bg-red-600 text-white border-transparent',
  ghost: 'hover:bg-slate-700 text-slate-400 hover:text-slate-100 border-transparent',
  outline: 'border-slate-600 hover:border-slate-500 text-slate-300 hover:text-slate-100 hover:bg-slate-700',
};
const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };

export const Button = ({ variant = 'primary', size = 'md', children, className = '', disabled, loading, ...props }) => (
  <button
    disabled={disabled || loading}
    className={`inline-flex items-center gap-2 font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`}
    {...props}
  >
    {loading && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current flex-shrink-0" />}
    {children}
  </button>
);
