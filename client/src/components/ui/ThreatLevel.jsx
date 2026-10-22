import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';
import { RiskMeter } from './RiskMeter';

export const ThreatLevel = ({
  level = 'MEDIUM',
  score = 0,
  affectedTxCount = 0,
  criticalAlertsCount = 0,
  flaggedTxCount = 0,
  lastUpdated,
  className = '',
}) => {
  const normLevel = String(level).toUpperCase();

  const levelConfigs = {
    CRITICAL: {
      label: 'CRITICAL THREAT LEVEL',
      description: 'Active severe anomaly burst detected. Immediate containment actions required.',
      badgeBg: 'bg-red-50 border-red-200 text-red-700',
      glow: 'border-red-200 bg-red-50',
      icon: ShieldAlert,
      iconColor: 'text-red-700',
    },
    HIGH: {
      label: 'HIGH RISK LEVEL',
      description: 'Elevated transaction anomalies and flagged payment velocity observed.',
      badgeBg: 'bg-orange-50 border-orange-200 text-orange-700',
      glow: 'border-orange-200 bg-orange-50',
      icon: AlertTriangle,
      iconColor: 'text-orange-700',
    },
    MEDIUM: {
      label: 'MEDIUM RISK LEVEL',
      description: 'Moderate heuristic triggers requiring regular analyst monitoring.',
      badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
      glow: 'border-amber-200 bg-amber-50',
      icon: AlertTriangle,
      iconColor: 'text-amber-700',
    },
    LOW: {
      label: 'NORMAL OPERATIONAL LEVEL',
      description: 'Transaction flow within nominal statistical and heuristic thresholds.',
      badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      glow: 'border-emerald-200 bg-emerald-50',
      icon: ShieldCheck,
      iconColor: 'text-emerald-700',
    },
  };

  const cfg = levelConfigs[normLevel] || levelConfigs.MEDIUM;
  const Icon = cfg.icon;

  return (
    <div className={`p-5 rounded-xl border transition-colors ${cfg.glow} ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Badge & Description */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-mono tracking-wider text-slate-600 uppercase font-semibold">
              Threat Intelligence Engine
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${cfg.badgeBg}`}>
              ● {cfg.label}
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-snug">{cfg.description}</p>
        </div>

        {/* Right: Key Threat Indicators */}
        <div className="flex items-center gap-4 lg:gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
          <div className="text-center sm:text-right">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Suspicious Activity</p>
            <p className="text-xl font-bold font-mono text-amber-700">
              {flaggedTxCount || affectedTxCount}{' '}
              <span className="text-xs font-normal text-slate-600">txns</span>
            </p>
          </div>
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />
          <div className="text-center sm:text-right">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Critical Alerts</p>
            <p className="text-xl font-bold font-mono text-red-700">
              {criticalAlertsCount}{' '}
              <span className="text-xs font-normal text-slate-600">threats</span>
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Threat Meter */}
      <div className="mt-4 pt-4 border-t border-slate-200/80">
        <RiskMeter score={score} />
      </div>
    </div>
  );
};
