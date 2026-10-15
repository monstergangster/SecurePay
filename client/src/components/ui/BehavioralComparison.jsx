import React from 'react';
import { AlertTriangle, CheckCircle, Smartphone, Clock, CreditCard, IndianRupee, Activity } from 'lucide-react';
import { formatINR } from '../../utils/currency';

export const BehavioralComparison = ({
  transaction,
  behavioralProfile,
  className = '',
}) => {
  if (!transaction) return null;

  const bp = behavioralProfile || {};
  const currentAmount = transaction.amount || 0;
  const meanAmount = bp.meanAmount || null;
  const zScore = bp.amountZScore !== undefined ? bp.amountZScore : null;
  const ratio = bp.amountToMeanRatio || (meanAmount ? Math.round((currentAmount / meanAmount) * 10) / 10 : null);
  
  const isAmountDeviated = (zScore !== null && Math.abs(zScore) >= 2) || (ratio !== null && ratio >= 2.5);
  const isNewDev = bp.isNewDevice === true;
  const isUnusualChan = bp.isUnusualChannel === true;
  const isUnusualHour = bp.isUnusualHourForCustomer === true;
  const burstCount = bp.burstCount || 0;

  // Extract hour
  const txHour = transaction.timestamp ? new Date(transaction.timestamp).getUTCHours() : null;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Customer Behavioural Baseline vs. Current Transaction</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Statistical deviation calculated from {bp.historyCount ? `${bp.historyCount} prior transactions` : 'customer transaction history'}
          </p>
        </div>
        {bp.behavioralRiskContribution > 0 ? (
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 border border-amber-800/60 px-2.5 py-1 rounded-md">
            +{bp.behavioralRiskContribution} Risk Score Impact
          </span>
        ) : (
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-1 rounded-md">
            Nominal Baseline
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Amount Deviation */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isAmountDeviated
              ? 'bg-rose-950/25 border-rose-800/70'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <IndianRupee size={14} className={isAmountDeviated ? 'text-rose-400' : 'text-slate-400'} />
              Transaction Amount
            </span>
            {isAmountDeviated && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                {ratio ? `${ratio}x Mean` : 'ANOMALY'}
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Typical Mean:</span>
              <span className="font-mono text-slate-300">
                {meanAmount !== null ? formatINR(meanAmount, bp.currency || '') : 'Baseline pending'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Current Tx:</span>
              <span className={`font-mono font-bold ${isAmountDeviated ? 'text-rose-400' : 'text-slate-100'}`}>
                {formatINR(currentAmount, transaction.currency || '')}
              </span>
            </div>
            {zScore !== null && (
              <div className="pt-1 border-t border-slate-800/80 flex justify-between text-[11px] font-mono text-slate-400">
                <span>Z-Score Deviation:</span>
                <span className={zScore >= 2 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  {zScore > 0 ? `+${zScore}` : zScore}σ
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Device Fingerprint */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isNewDev ? 'bg-amber-950/25 border-amber-800/70' : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Smartphone size={14} className={isNewDev ? 'text-amber-400' : 'text-slate-400'} />
              Hardware Device
            </span>
            {isNewDev ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                NEW DEVICE
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-400">KNOWN</span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Hardware Profile:</span>
              <span className="font-mono text-slate-300">
                {isNewDev ? 'Unrecognized ID' : 'Recognized Hardware'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Device ID:</span>
              <span className="font-mono text-slate-400 truncate max-w-[120px]" title={transaction.deviceMetadata?.deviceId}>
                {transaction.deviceMetadata?.deviceId || 'DEV-UNSPECIFIED'}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 truncate">
              IP: {transaction.deviceMetadata?.ipAddress || '127.0.0.1'}
            </div>
          </div>
        </div>

        {/* Metric 3: Payment Channel */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isUnusualChan ? 'bg-amber-950/25 border-amber-800/70' : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <CreditCard size={14} className={isUnusualChan ? 'text-amber-400' : 'text-slate-400'} />
              Channel Deviation
            </span>
            {isUnusualChan && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                NEW CHANNEL
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Current Channel:</span>
              <span className="font-mono text-cyan-400 font-semibold capitalize">
                {transaction.channel?.replace(/_/g, ' ') || 'card'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Familiarity:</span>
              <span className="font-mono text-slate-300">
                {isUnusualChan ? 'Never used before' : 'Standard channel'}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
              Risk Weight: {isUnusualChan ? '+15' : '0'}
            </div>
          </div>
        </div>

        {/* Metric 4: Hour & Velocity */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isUnusualHour || burstCount >= 3 ? 'bg-rose-950/25 border-rose-800/70' : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Clock size={14} className={isUnusualHour ? 'text-amber-400' : 'text-slate-400'} />
              Time & Velocity
            </span>
            {burstCount >= 3 ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                BURST VELOCITY
              </span>
            ) : isUnusualHour ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                OFF-HOURS
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-400">NOMINAL</span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Timestamp UTC:</span>
              <span className="font-mono text-slate-300">
                {txHour !== null ? `${String(txHour).padStart(2, '0')}:00 UTC` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Burst In Window:</span>
              <span className={`font-mono font-bold ${burstCount >= 3 ? 'text-rose-400' : 'text-slate-300'}`}>
                {burstCount} txns / 15m
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
              Pattern: {isUnusualHour ? 'Anomalous schedule' : 'Within normal active hours'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
