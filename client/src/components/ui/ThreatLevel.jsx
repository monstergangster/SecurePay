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
      badgeBg: 'bg-red-950/80 border-red-800 text-red-400',
      glow: 'border-red-900/60 bg-gradient-to-r from-red-950/40 via-slate-900/90 to-slate-900/90',
      icon: ShieldAlert,
      iconColor: 'text-red-400',
    },
    HIGH: {
      label: 'HIGH RISK LEVEL',
      description: 'Elevated transaction anomalies and flagged payment velocity observed.',
      badgeBg: 'bg-orange-950/80 border-orange-800 text-orange-400',
      glow: 'border-orange-900/50 bg-gradient-to-r from-orange-950/30 via-slate-900/90 to-slate-900/90',
      icon: AlertTriangle,
      iconColor: 'text-orange-400',
    },
    MEDIUM: {
      label: 'MEDIUM RISK LEVEL',
      description: 'Moderate heuristic triggers requiring regular analyst monitoring.',
      badgeBg: 'bg-amber-950/80 border-amber-800 text-amber-400',
      glow: 'border-amber-900/50 bg-gradient-to-r from-amber-950/20 via-slate-900/90 to-slate-900/90',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
    },
    LOW: {
      label: 'NORMAL OPERATIONAL LEVEL',
      description: 'Transaction flow within nominal statistical and heuristic thresholds.',
      badgeBg: 'bg-emerald-950/80 border-emerald-800 text-emerald-400',
      glow: 'border-emerald-900/40 bg-gradient-to-r from-emerald-950/20 via-slate-900/90 to-slate-900/90',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
    },
  };

  const cfg = levelConfigs[normLevel] || levelConfigs.MEDIUM;
  const Icon = cfg.icon;

  return (
    <div className={`p-5 rounded-2xl border backdrop-blur transition-all ${cfg.glow} ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Badge & Description */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase font-semibold">
              Threat Intelligence Engine
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${cfg.badgeBg}`}>
              ● {cfg.label}
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-snug">{cfg.description}</p>
        </div>

        {/* Right: Key Threat Indicators */}
        <div className="flex items-center gap-4 lg:gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
          <div className="text-center sm:text-right">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Suspicious Activity</p>
            <p className="text-xl font-bold font-mono text-amber-400">
              {flaggedTxCount || affectedTxCount}{' '}
              <span className="text-xs font-normal text-slate-400">txns</span>
            </p>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block" />
          <div className="text-center sm:text-right">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Critical Alerts</p>
            <p className="text-xl font-bold font-mono text-red-400">
              {criticalAlertsCount}{' '}
              <span className="text-xs font-normal text-slate-400">threats</span>
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Threat Meter */}
      <div className="mt-4 pt-4 border-t border-slate-800/80">
        <RiskMeter score={score} />
      </div>
    </div>
  );
};
