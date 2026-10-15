const variants = {
  low: 'bg-green-900/40 text-green-400 border-green-800/40',
  medium: 'bg-amber-900/40 text-amber-400 border-amber-800/40',
  high: 'bg-orange-900/40 text-orange-400 border-orange-800/40',
  critical: 'bg-red-900/40 text-red-400 border-red-800/40',
  open: 'bg-blue-900/40 text-blue-400 border-blue-800/40',
  in_review: 'bg-amber-900/40 text-amber-400 border-amber-800/40',
  escalated: 'bg-orange-900/40 text-orange-400 border-orange-800/40',
  resolved: 'bg-green-900/40 text-green-400 border-green-800/40',
  false_positive: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
  approved: 'bg-green-900/40 text-green-400 border-green-800/40',
  flagged: 'bg-amber-900/40 text-amber-400 border-amber-800/40',
  blocked: 'bg-red-900/40 text-red-400 border-red-800/40',
  pending: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
  declined: 'bg-red-900/40 text-red-400 border-red-800/40',
  reversed: 'bg-purple-900/40 text-purple-400 border-purple-800/40',
  in_progress: 'bg-blue-900/40 text-blue-400 border-blue-800/40',
  closed: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
  confirmed_fraud: 'bg-red-900/40 text-red-400 border-red-800/40',
  legitimate: 'bg-green-900/40 text-green-400 border-green-800/40',
  inconclusive: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
  admin: 'bg-purple-900/40 text-purple-400 border-purple-800/40',
  analyst: 'bg-cyan-900/40 text-cyan-400 border-cyan-800/40',
};

export const Badge = ({ variant, children, className = '' }) => {
  const style = variants[variant] || 'bg-slate-700/40 text-slate-400 border-slate-600/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style} ${className}`}>
      {children}
    </span>
  );
};
