import React from 'react';
import { getRiskInfo } from './RiskBadge';

export const RiskScore = ({ score, size = 'lg', subtitle = 'Risk Score', showGauge = true }) => {
  const isAssessed = score !== null && score !== undefined && !isNaN(score);
  const numericScore = isAssessed ? Math.min(100, Math.max(0, Math.round(score))) : 0;
  const info = getRiskInfo(isAssessed ? numericScore : null);

  // Gauge calculations for SVG circular meter
  const radius = size === 'xl' ? 52 : size === 'lg' ? 42 : 28;
  const stroke = size === 'xl' ? 7 : size === 'lg' ? 6 : 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (numericScore / 100) * circumference;

  const colorMap = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#10b981',
    unassessed: '#64748b',
  };
  const strokeColor = colorMap[info.level];

  if (!showGauge) {
    return (
      <div className="flex items-baseline gap-1">
        <span className={`font-mono font-bold ${info.text} ${size === 'xl' ? 'text-4xl' : size === 'lg' ? 'text-2xl' : 'text-lg'}`}>
          {isAssessed ? numericScore : '—'}
        </span>
        <span className="text-xs text-slate-500 font-mono">/100</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="relative inline-flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="#1e293b"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={strokeColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s ease' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className={`font-mono font-extrabold ${info.text} ${size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-2xl' : 'text-base'}`}>
            {isAssessed ? numericScore : '—'}
          </span>
          <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">/ 100</span>
        </div>
      </div>
      {subtitle && (
        <div className="mt-2 text-center">
          <span className={`text-xs font-semibold uppercase tracking-wider ${info.text}`}>
            {info.label} RISK
          </span>
        </div>
      )}
    </div>
  );
};
