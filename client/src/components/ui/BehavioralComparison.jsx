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
          <h4 className="text-sm font-semibold text-slate-800">Customer Behavioural Baseline vs. Current Transaction</h4>
          <p className="text-xs text-slate-600 mt-0.5">
            Statistical deviation calculated from {bp.historyCount ? `${bp.historyCount} prior transactions` : 'customer transaction history'}
          </p>
        </div>
        {bp.behavioralRiskContribution > 0 ? (
          <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            +{bp.behavioralRiskContribution} Risk Score Impact
          </span>
        ) : (
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            Nominal Baseline
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Amount Deviation */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isAmountDeviated
              ? 'bg-rose-50 border-rose-200'
              : 'bg-white/80 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <IndianRupee size={14} className={isAmountDeviated ? 'text-rose-700' : 'text-slate-600'} />
              Transaction Amount
            </span>
            {isAmountDeviated && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {ratio ? `${ratio}x Mean` : 'ANOMALY'}
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Typical Mean:</span>
              <span className="font-mono text-slate-700">
                {meanAmount !== null ? formatINR(meanAmount, bp.currency || '') : 'Baseline pending'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Current Tx:</span>
              <span className={`font-mono font-bold ${isAmountDeviated ? 'text-rose-700' : 'text-slate-900'}`}>
                {formatINR(currentAmount, transaction.currency || '')}
              </span>
            </div>
            {zScore !== null && (
              <div className="pt-1 border-t border-slate-200/80 flex justify-between text-[11px] font-mono text-slate-600">
                <span>Z-Score Deviation:</span>
                <span className={zScore >= 2 ? 'text-rose-700 font-bold' : 'text-slate-700'}>
                  {zScore > 0 ? `+${zScore}` : zScore}σ
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Device Fingerprint */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isNewDev ? 'bg-amber-50 border-amber-200' : 'bg-white/80 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Smartphone size={14} className={isNewDev ? 'text-amber-700' : 'text-slate-600'} />
              Hardware Device
            </span>
            {isNewDev ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                NEW DEVICE
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-700">KNOWN</span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Hardware Profile:</span>
              <span className="font-mono text-slate-700">
                {isNewDev ? 'Unrecognized ID' : 'Recognized Hardware'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Device ID:</span>
              <span className="font-mono text-slate-600 truncate max-w-[120px]" title={transaction.deviceMetadata?.deviceId}>
                {transaction.deviceMetadata?.deviceId || 'DEV-UNSPECIFIED'}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-200/80 text-[11px] font-mono text-slate-600 truncate">
              IP: {transaction.deviceMetadata?.ipAddress || '127.0.0.1'}
            </div>
          </div>
        </div>

        {/* Metric 3: Payment Channel */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isUnusualChan ? 'bg-amber-50 border-amber-200' : 'bg-white/80 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <CreditCard size={14} className={isUnusualChan ? 'text-amber-700' : 'text-slate-600'} />
              Channel Deviation
            </span>
            {isUnusualChan && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                NEW CHANNEL
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Current Channel:</span>
              <span className="font-mono text-blue-700 font-semibold capitalize">
                {transaction.channel?.replace(/_/g, ' ') || 'card'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Familiarity:</span>
              <span className="font-mono text-slate-700">
                {isUnusualChan ? 'Never used before' : 'Standard channel'}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-200/80 text-[11px] font-mono text-slate-600">
              Risk Weight: {isUnusualChan ? '+15' : '0'}
            </div>
          </div>
        </div>

        {/* Metric 4: Hour & Velocity */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isUnusualHour || burstCount >= 3 ? 'bg-rose-50 border-rose-200' : 'bg-white/80 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className={isUnusualHour ? 'text-amber-700' : 'text-slate-600'} />
              Time & Velocity
            </span>
            {burstCount >= 3 ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                BURST VELOCITY
              </span>
            ) : isUnusualHour ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                OFF-HOURS
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-700">NOMINAL</span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Timestamp UTC:</span>
              <span className="font-mono text-slate-700">
                {txHour !== null ? `${String(txHour).padStart(2, '0')}:00 UTC` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Burst In Window:</span>
              <span className={`font-mono font-bold ${burstCount >= 3 ? 'text-rose-700' : 'text-slate-700'}`}>
                {burstCount} txns / 15m
              </span>
            </div>
            <div className="pt-1 border-t border-slate-200/80 text-[11px] font-mono text-slate-600">
              Pattern: {isUnusualHour ? 'Anomalous schedule' : 'Within normal active hours'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
