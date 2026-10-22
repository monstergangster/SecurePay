import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Clock,
  Activity,
  TrendingUp,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { RiskScore } from '../components/ui/RiskScore';
import { RiskMeter } from '../components/ui/RiskMeter';
import { Skeleton } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatINR } from '../utils/currency';

export default function CustomerDetail() {
  const { customerId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchCustomer = useCallback(async () => {
    setLoadError('');
    try {
      const response = await api.get(`/customers/${customerId}`);
      if (!response.data?.data?.customer) throw new Error('Customer profile not found.');
      setData(response.data.data);
    } catch (error) {
      setData(null);
      setLoadError(
        error.response?.data?.message
          || error.message
          || 'Unable to load this customer profile. Check your connection and try again.'
      );
      toast.error('Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    setLoading(true);
    fetchCustomer();
  }, [fetchCustomer]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data || !data.customer) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center">
        <p role="alert" className="text-sm text-slate-700">{loadError || 'Customer profile not found.'}</p>
        <div className="mt-4 flex justify-center gap-3">
          {loadError && (
            <button
              type="button"
              onClick={() => { setLoading(true); fetchCustomer(); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50"
            >
              Retry
            </button>
          )}
          <Link
            to="/customers"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  const { customer: c, recentTransactions = [], alerts = [], behavioralStats = {} } = data;
  const hasRiskAssessment = Number.isFinite(c.riskScore);
  const isHighRisk = hasRiskAssessment && c.riskScore >= 55;

  // Extract known channels and devices from transactions
  const uniqueChannels = Array.from(new Set(recentTransactions.map((t) => t.channel).filter(Boolean)));
  const uniqueDevices = Array.from(
    new Set(recentTransactions.map((t) => t.deviceMetadata?.deviceId).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <Link
            to="/customers"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{c.customerId}</h1>
              <RiskBadge level={c.riskLevel} score={c.riskScore} size="sm" />
              {c.isDemo && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                  DEMO PROFILE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Customer Risk Profile & Baseline Telemetry
            </p>
          </div>
        </div>
      </div>

      {/* 2. Visual Risk & Baseline Banner */}
      <div
        className={`p-6 rounded-2xl border backdrop-blur transition-all ${
          c.riskLevel === 'critical'
            ? 'bg-red-50 border-red-200'
            : isHighRisk
            ? 'bg-orange-50 border-orange-200'
            : 'bg-white/80 border-slate-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                Entity Risk Assessment
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                isHighRisk ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              }`}>
                {!hasRiskAssessment
                  ? 'RISK ASSESSMENT UNAVAILABLE'
                  : isHighRisk
                  ? 'ANOMALOUS BEHAVIOUR SUSPECTED'
                  : 'NORMAL BEHAVIOURAL PROFILE'}
              </span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed max-w-2xl">
              {!hasRiskAssessment
                ? 'The customer has not received a risk assessment yet. This does not indicate a low-risk or normal behavioural profile.'
                : isHighRisk
                ? 'This customer exhibits significant deviations from normal transacting patterns, including elevated transaction amounts, frequency friction, or suspicious channel activity.'
                : 'Customer transactions are currently aligned with established statistical baselines and known hardware configurations.'}
            </p>

            <div className="flex items-center gap-6 pt-1 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Total Historical Volume</span>
                <span className="text-slate-900 font-bold text-base">
                  {formatINR(c.totalTransactionAmount, c.currency || '')}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-100" />
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Transaction Frequency</span>
                <span className="text-slate-900 font-bold text-base">{c.transactionCount} records</span>
              </div>
              <div className="h-8 w-px bg-slate-100" />
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Flagged Rate</span>
                <span className={`font-bold text-base ${c.flaggedTransactionCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {c.flaggedTransactionCount} ({c.transactionCount ? ((c.flaggedTransactionCount / c.transactionCount) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 lg:border-l border-slate-200 lg:pl-8">
            <RiskScore score={c.riskScore} size="lg" subtitle="Entity Score" />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200/80">
          <RiskMeter score={c.riskScore} />
        </div>
      </div>

      {/* 3. Behavioral Profile & Telemetry Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>STATISTICAL BEHAVIOURAL BASELINE</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-mono">Average Transaction</span>
              <p className="font-mono text-base font-bold text-slate-900">
                {formatINR(behavioralStats.avgAmount, behavioralStats.currency || '')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-mono">Maximum Historical Tx</span>
              <p className="font-mono text-base font-bold text-amber-700">
                {formatINR(behavioralStats.maxAmount, behavioralStats.currency || '')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-mono">First Seen Date</span>
              <p className="font-mono text-slate-800">
                {c.firstTransactionAt ? format(new Date(c.firstTransactionAt), 'PP') : '—'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase font-mono">Last Active Seen</span>
              <p className="font-mono text-slate-800">
                {c.lastTransactionAt ? format(new Date(c.lastTransactionAt), 'PP') : '—'}
              </p>
            </div>
          </div>

          {/* Known hardware & channel familiarity */}
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-xs">
            <p className="font-mono uppercase text-slate-600 font-semibold text-[11px]">
              Observed Channels & Devices
            </p>
            <div className="flex gap-2 flex-wrap">
              {uniqueChannels.map((ch) => (
                <span
                  key={ch}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-700 font-mono text-[11px] capitalize"
                >
                  {ch.replace(/_/g, ' ')}
                </span>
              ))}
              {uniqueDevices.slice(0, 3).map((dev) => (
                <span
                  key={dev}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono text-[11px]"
                >
                  {dev}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Associated Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>ACTIVE THREAT ALERTS ({alerts.length})</CardTitle>
          </CardHeader>
          {!alerts.length ? (
            <p className="text-xs text-slate-500 text-center py-12">
              No active or historical threat alerts recorded for this customer.
            </p>
          ) : (
            <div className="space-y-2.5">
              {alerts.slice(0, 5).map((a) => (
                <Link
                  key={a._id}
                  to={`/alerts/${a._id}`}
                  className="p-3 rounded-xl bg-white/80 border border-slate-200 hover:border-slate-200 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{a.title}</p>
                    <p className="text-[10px] font-mono text-slate-500">{a.alertId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={a.severity} size="sm" />
                    <StatusBadge status={a.status} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 4. Customer's Recent Transactions Table */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide font-mono">
            Transaction Activity History ({recentTransactions.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-mono text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Channel</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Risk Score</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {!recentTransactions.length ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No transactions recorded.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-slate-100/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/transactions/${tx._id}`}
                        className="font-mono text-blue-700 hover:underline font-bold"
                      >
                        {tx.transactionId}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {formatINR(tx.amount, tx.currency || '')}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 capitalize">
                      {tx.channel?.replace(/_/g, ' ') || 'card'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={tx.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <RiskBadge level={tx.riskLevel} size="sm" />
                        <span className="font-mono text-slate-700 font-bold">{tx.riskScore ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {tx.timestamp ? format(new Date(tx.timestamp), 'MMM dd, HH:mm') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/transactions/${tx._id}`}
                        className="text-blue-700 hover:text-blue-700 font-mono text-xs inline-flex items-center gap-1"
                      >
                        Details <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
