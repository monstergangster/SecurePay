import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldX, Clock, Eye, AlertOctagon, HelpCircle } from 'lucide-react';

const statusConfigs = {
  // Transaction statuses
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  flagged: { label: 'Flagged', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
  blocked: { label: 'Blocked', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: ShieldX },
  pending: { label: 'Pending', bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200', icon: Clock },
  declined: { label: 'Declined', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: ShieldX },
  reversed: { label: 'Reversed', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: Clock },
  held_for_review: { label: 'Held for Review', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Eye },

  // Alert & Case statuses
  open: { label: 'Open', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', icon: Clock },
  in_review: { label: 'In Review', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Eye },
  in_progress: { label: 'In Progress', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', icon: Clock },
  escalated: { label: 'Escalated', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertOctagon },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  closed: { label: 'Closed', bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200', icon: CheckCircle2 },
  false_positive: { label: 'False Positive', bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200', icon: CheckCircle2 },

  // Case outcomes
  confirmed_fraud: { label: 'Confirmed Fraud', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: ShieldX },
  legitimate: { label: 'Legitimate', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  inconclusive: { label: 'Inconclusive', bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200', icon: HelpCircle },

  // User roles
  admin: { label: 'Administrator', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: null },
  analyst: { label: 'Fraud Analyst', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: null },
};

export const StatusBadge = ({ status, showIcon = true, className = '', size = 'md' }) => {
  if (!status) return null;
  const key = String(status).toLowerCase();
  const cfg = statusConfigs[key] || {
    label: key.replace(/_/g, ' '),
    bg: 'bg-slate-100/80',
    text: 'text-slate-600',
    border: 'border-slate-200',
    icon: null,
  };

  const Icon = showIcon ? cfg.icon : null;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses} ${className}`}
    >
      {Icon && <Icon size={size === 'sm' ? 10 : 12} className="flex-shrink-0" />}
      <span className="capitalize">{cfg.label}</span>
    </span>
  );
};
