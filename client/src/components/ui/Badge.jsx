const variants = {
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  escalated: 'bg-orange-50 text-orange-700 border-orange-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  false_positive: 'bg-slate-200/40 text-slate-600 border-slate-300/40',
  approved: 'bg-green-50 text-green-700 border-green-200',
  flagged: 'bg-amber-50 text-amber-700 border-amber-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-slate-200/40 text-slate-600 border-slate-300/40',
  declined: 'bg-red-50 text-red-700 border-red-200',
  reversed: 'bg-purple-50 text-purple-700 border-purple-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-slate-200/40 text-slate-600 border-slate-300/40',
  confirmed_fraud: 'bg-red-50 text-red-700 border-red-200',
  legitimate: 'bg-green-50 text-green-700 border-green-200',
  inconclusive: 'bg-slate-200/40 text-slate-600 border-slate-300/40',
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  analyst: 'bg-blue-50 text-blue-700 border-blue-200',
};

export const Badge = ({ variant, children, className = '' }) => {
  const style = variants[variant] || 'bg-slate-200/40 text-slate-600 border-slate-300/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style} ${className}`}>
      {children}
    </span>
  );
};
