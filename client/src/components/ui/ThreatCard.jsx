import React from 'react';
import { formatINR } from '../../utils/currency';
import { Link } from 'react-router-dom';
import { ArrowRight, Ban, Eye } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { formatDistanceToNow } from 'date-fns';

export const ThreatCard = ({
  alert,
  onBlockTransaction,
  isBlocking = false,
  className = '',
}) => {
  if (!alert) return null;
  const tx = alert.transactionId || {};
  const isCritical = alert.severity === 'critical';

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isCritical
          ? 'bg-red-50 border-red-200 hover:border-red-300'
          : 'bg-white/90 border-slate-200 hover:border-slate-200'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <RiskBadge level={alert.severity} size="sm" />
          <span className="text-xs font-mono text-slate-600 font-semibold">{alert.alertId}</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
          {alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : ''}
        </span>
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <Link
          to={`/alerts/${alert._id}`}
          className="text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors line-clamp-1"
        >
          {alert.title}
        </Link>
      </div>

      {/* Transaction & Financial Info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-white/60 border border-slate-200/80 mb-3 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-mono">Amount</span>
          <span className="font-mono font-bold text-slate-800">
            {tx.amount !== undefined ? formatINR(tx.amount, tx.currency || '') : '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-mono">Customer</span>
          <Link
            to={tx.customerId ? `/customers/${tx.customerId}` : '#'}
            className="font-mono text-blue-700 hover:underline truncate block"
          >
            {tx.customerId || '—'}
          </Link>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-mono">Risk Score</span>
          <span className="font-mono font-bold text-red-700">
            {tx.riskScore !== undefined && tx.riskScore !== null ? `${tx.riskScore}/100` : '—'}
          </span>
        </div>
      </div>

      {/* Triggered reasons / rules */}
      {alert.triggeredRules && alert.triggeredRules.length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            Detection Triggers ({alert.triggeredRules.length})
          </p>
          <div className="space-y-1">
            {alert.triggeredRules.slice(0, 2).map((r, i) => (
              <div key={i} className="flex items-baseline gap-1.5 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1" />
                <span className="truncate">{r.description || r.rule}</span>
              </div>
            ))}
            {alert.triggeredRules.length > 2 && (
              <span className="text-[11px] text-blue-700 pl-3 block font-mono">
                +{alert.triggeredRules.length - 2} additional signals
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions: Investigate and optional Block */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
        {tx._id ? (
          <Link
            to={`/transactions/${tx._id}`}
            className="text-xs text-slate-600 hover:text-slate-800 font-mono flex items-center gap-1"
          >
            <Eye size={12} /> {tx.transactionId || 'View Tx'}
          </Link>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {onBlockTransaction && tx._id && tx.status !== 'blocked' && (
            <button
              onClick={() => onBlockTransaction(tx._id)}
              disabled={isBlocking}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Ban size={12} /> Block
            </button>
          )}

          <Link
            to={`/alerts/${alert._id}`}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1"
          >
            Investigate <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
};
