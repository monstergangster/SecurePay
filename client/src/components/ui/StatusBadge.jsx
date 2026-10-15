import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldX, Clock, Eye, AlertOctagon, HelpCircle } from 'lucide-react';

const statusConfigs = {
  // Transaction statuses
  approved: { label: 'Approved', bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60', icon: CheckCircle2 },
  flagged: { label: 'Flagged', bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60', icon: AlertTriangle },
  blocked: { label: 'Blocked', bg: 'bg-rose-950/70', text: 'text-rose-400', border: 'border-rose-800/70', icon: ShieldX },
  pending: { label: 'Pending', bg: 'bg-slate-800/80', text: 'text-slate-400', border: 'border-slate-700', icon: Clock },
  declined: { label: 'Declined', bg: 'bg-rose-950/60', text: 'text-rose-400', border: 'border-rose-800/60', icon: ShieldX },
  reversed: { label: 'Reversed', bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-800/60', icon: Clock },
  held_for_review: { label: 'Held for Review', bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60', icon: Eye },

  // Alert & Case statuses
  open: { label: 'Open', bg: 'bg-sky-950/60', text: 'text-sky-400', border: 'border-sky-800/60', icon: Clock },
  in_review: { label: 'In Review', bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60', icon: Eye },
  in_progress: { label: 'In Progress', bg: 'bg-sky-950/60', text: 'text-sky-400', border: 'border-sky-800/60', icon: Clock },
  escalated: { label: 'Escalated', bg: 'bg-orange-950/60', text: 'text-orange-400', border: 'border-orange-800/60', icon: AlertOctagon },
  resolved: { label: 'Resolved', bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60', icon: CheckCircle2 },
  closed: { label: 'Closed', bg: 'bg-slate-800/80', text: 'text-slate-400', border: 'border-slate-700', icon: CheckCircle2 },
  false_positive: { label: 'False Positive', bg: 'bg-slate-800/80', text: 'text-slate-400', border: 'border-slate-700', icon: CheckCircle2 },

  // Case outcomes
  confirmed_fraud: { label: 'Confirmed Fraud', bg: 'bg-rose-950/80', text: 'text-rose-400', border: 'border-rose-800/80', icon: ShieldX },
  legitimate: { label: 'Legitimate', bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60', icon: CheckCircle2 },
  inconclusive: { label: 'Inconclusive', bg: 'bg-slate-800/80', text: 'text-slate-400', border: 'border-slate-700', icon: HelpCircle },

  // User roles
  admin: { label: 'Administrator', bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-800/60', icon: null },
  analyst: { label: 'Fraud Analyst', bg: 'bg-cyan-950/60', text: 'text-cyan-400', border: 'border-cyan-800/60', icon: null },
};

export const StatusBadge = ({ status, showIcon = true, className = '', size = 'md' }) => {
  if (!status) return null;
  const key = String(status).toLowerCase();
  const cfg = statusConfigs[key] || {
    label: key.replace(/_/g, ' '),
    bg: 'bg-slate-800/80',
    text: 'text-slate-400',
    border: 'border-slate-700',
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
