import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, AlertTriangle, ShieldX, Cpu, Fingerprint, Eye, ArrowDown } from 'lucide-react';
import { formatINR } from '../../utils/currency';

export const DetectionTimeline = ({
  transaction,
  alerts = [],
  assessments = [],
  className = '',
}) => {
  if (!transaction) return null;

  const events = [];

  // 1. Transaction Initiated
  if (transaction.timestamp) {
    events.push({
      time: new Date(transaction.timestamp),
      title: 'Transaction Initiated',
      description: `Inbound ${formatINR(transaction.amount, transaction.currency || '')} transaction via ${transaction.channel?.replace(/_/g, ' ') || 'standard'} channel by ${transaction.customerId}.`,
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
    });
  }

  // 2. Device Metadata Evaluated
  if (transaction.deviceMetadata) {
    const loc = transaction.deviceMetadata.location;
    const locStr = loc ? `${loc.city || ''}${loc.city && loc.country ? ', ' : ''}${loc.country || ''}` : '';
    events.push({
      time: new Date(new Date(transaction.timestamp || Date.now()).getTime() + 120),
      title: 'Hardware & Geo Verification',
      description: `Device hardware fingerprint ${transaction.deviceMetadata.deviceId || 'DEV-STANDARD'} evaluated. IP: ${transaction.deviceMetadata.ipAddress || '127.0.0.1'}${locStr ? ` (${locStr})` : ''}.`,
      icon: Fingerprint,
      color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
    });
  }

  // 3. Risk Engine Assessment
  if (transaction.riskAssessedAt || transaction.riskScore !== null) {
    const isHigh = (transaction.riskScore || 0) >= 55;
    const triggeredCount = transaction.riskReasons?.length || 0;
    events.push({
      time: transaction.riskAssessedAt ? new Date(transaction.riskAssessedAt) : new Date(new Date(transaction.timestamp || Date.now()).getTime() + 450),
      title: 'Risk Engine Evaluation',
      description: `Calculated risk score: ${transaction.riskScore ?? 'N/A'}/100 (${(transaction.riskLevel || 'unassessed').toUpperCase()}). Triggered ${triggeredCount} rule(s) and heuristic thresholds.`,
      icon: isHigh ? AlertTriangle : CheckCircle2,
      color: isHigh ? 'text-amber-400 bg-amber-950/60 border-amber-800' : 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
    });
  }

  // 4. ML Anomaly Scoring (if ML was invoked)
  if (transaction.mlScore !== null && transaction.mlScore !== undefined) {
    const isAnom = transaction.mlDecision === 'anomalous';
    events.push({
      time: new Date(new Date(transaction.riskAssessedAt || transaction.timestamp || Date.now()).getTime() + 650),
      title: 'ML Isolation Forest Scoring',
      description: `Statistical inference returned ML anomaly score: ${transaction.mlScore}/100 (${transaction.mlDecision?.toUpperCase()}). Combined into hybrid score policy.`,
      icon: Cpu,
      color: isAnom ? 'text-purple-400 bg-purple-950/60 border-purple-800' : 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
    });
  }

  // 5. Threat Alert Generated
  if (alerts && alerts.length > 0) {
    alerts.forEach((alt) => {
      events.push({
        time: alt.createdAt ? new Date(alt.createdAt) : new Date(),
        title: `Security Alert Generated (${alt.severity?.toUpperCase()})`,
        description: `${alt.title}. Alert ID: ${alt.alertId}. Status: ${alt.status?.replace(/_/g, ' ')}.`,
        icon: AlertTriangle,
        color: alt.severity === 'critical' ? 'text-red-400 bg-red-950/60 border-red-800' : 'text-amber-400 bg-amber-950/60 border-amber-800',
      });
    });
  }

  // 6. Action Recorded
  const isBlocked = transaction.status === 'blocked';
  const isApproved = transaction.status === 'approved';
  events.push({
    time: new Date(new Date(transaction.riskAssessedAt || transaction.timestamp || Date.now()).getTime() + 1200),
    title: isBlocked ? 'Transaction Intercepted & Blocked' : isApproved ? 'Transaction Cleared & Approved' : `Status Set to ${transaction.status?.toUpperCase()}`,
    description: isBlocked
      ? 'Payment blocked automatically by high-risk defense threshold to prevent financial loss.'
      : isApproved
      ? 'Payment cleared for processing within acceptable operational risk parameters.'
      : `Transaction held for operational review (${transaction.reviewStatus || 'pending_review'}).`,
    icon: isBlocked ? ShieldX : CheckCircle2,
    color: isBlocked ? 'text-red-400 bg-red-950/80 border-red-800' : isApproved ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800' : 'text-amber-400 bg-amber-950/80 border-amber-800',
  });

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-200">Chronological Detection Timeline</h4>
        <span className="text-[11px] font-mono text-slate-400">{events.length} lifecycle events</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {events.map((evt, idx) => {
          const Icon = evt.icon;
          return (
            <div key={idx} className="relative group">
              {/* Event node icon */}
              <div
                className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border text-[10px] ${evt.color}`}
              >
                <Icon size={11} />
              </div>

              <div className="bg-slate-900/70 border border-slate-800/80 p-3 rounded-xl hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h5 className="text-xs font-semibold text-slate-200">{evt.title}</h5>
                  <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                    {evt.time ? format(evt.time, 'HH:mm:ss.SSS') : '—'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{evt.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
