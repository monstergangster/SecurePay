const v = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent',
  ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-transparent',
  outline: 'border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 hover:bg-slate-50',
};
const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };

export const Button = ({ variant = 'primary', size = 'md', children, className = '', disabled, loading, ...props }) => (
  <button
    disabled={disabled || loading}
    className={`inline-flex items-center gap-2 font-medium rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`}
    {...props}
  >
    {loading && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current flex-shrink-0" />}
    {children}
  </button>
);
