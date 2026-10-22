import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  AlertTriangle,
  ArrowLeftRight,
  ShieldAlert,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  IndianRupee,
  Radio,
  ExternalLink,
  Ban,
  Eye,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { MetricCard } from '../components/ui/MetricCard';
import { ThreatCard } from '../components/ui/ThreatCard';
import { Skeleton, EmptyState } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { formatINR } from '../utils/currency';

const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 text-xs shadow-xl font-mono">
        <p className="text-slate-400 mb-1.5 font-semibold">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
            <span style={{ color: p.color }} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}:
            </span>
            <span className="text-white font-bold">{p.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [liveStream, setLiveStream] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockingId, setBlockingId] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [transactionError, setTransactionError] = useState('');
  const [healthUnavailable, setHealthUnavailable] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    setDashboardError('');
    setTransactionError('');
    try {
      const [statsRes, healthRes, txRes] = await Promise.allSettled([
        api.get('/analytics/dashboard'),
        api.get('/health'),
        api.get('/transactions', { params: { limit: 8, sortBy: 'timestamp', sortOrder: 'desc' } }),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data.success) {
        setStats(statsRes.value.data.data);
      } else {
        setStats(null);
        setDashboardError(
          statsRes.status === 'rejected'
            ? statsRes.reason?.response?.data?.message || 'Dashboard metrics could not be loaded.'
            : 'Dashboard metrics response was unavailable.'
        );
      }
      if (healthRes.status === 'fulfilled' && healthRes.value.data.success) {
        setHealth(healthRes.value.data.data);
        setHealthUnavailable(false);
      } else if (healthRes.status === 'rejected') {
        setHealth(healthRes.reason?.response?.data?.data || null);
        setHealthUnavailable(!healthRes.reason?.response?.data?.data);
      } else {
        setHealth(null);
        setHealthUnavailable(true);
      }
      if (txRes.status === 'fulfilled' && txRes.value.data.success) {
        setLiveStream(txRes.value.data.data || []);
      } else {
        setLiveStream([]);
        setTransactionError(
          txRes.status === 'rejected'
            ? txRes.reason?.response?.data?.message || 'Recent transactions could not be loaded.'
            : 'Recent transactions response was unavailable.'
        );
      }
    } catch {
      toast.error('Failed to sync command center feeds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Honest 20-second background polling using actual API
    const interval = setInterval(() => {
      fetchData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleBlockTransaction = async (txId) => {
    setBlockingId(txId);
    try {
      await api.patch(`/transactions/${txId}/status`, {
        status: 'blocked',
        reviewStatus: 'reviewed',
        notes: 'Directly blocked from Fraud Intelligence Command Center active threat panel.',
      });
      toast.success('Transaction intercepted & blocked');
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block transaction');
    } finally {
      setBlockingId(null);
    }
  };

  const summary = stats?.summary || {};
  const totalTx = summary.totalTx;
  const flaggedCount = summary.flaggedTx === undefined || summary.heldReviewTx === undefined
    ? undefined
    : summary.flaggedTx + summary.heldReviewTx;
  const flaggedRatio = totalTx > 0 && flaggedCount !== undefined
    ? `${((flaggedCount / totalTx) * 100).toFixed(1)}%`
    : null;
  const volumeData = stats?.volumeData || [];
  const riskDist = stats?.riskDistribution || [];
  const activeThreats = stats?.activeThreats || [];

  // Compute total flagged in 14 days for trend statement
  const totalPeriodFlagged = volumeData.reduce((acc, d) => acc + (d.flagged || 0), 0);
  const totalPeriodCount = volumeData.reduce((acc, d) => acc + (d.count || 0), 0);
  const periodAnomalyRatio = totalPeriodCount > 0
    ? `${((totalPeriodFlagged / totalPeriodCount) * 100).toFixed(1)}%`
    : null;

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Command Center</h1>
          </div>
          <p className="text-xs text-slate-400">
            A clear view of service health, suspicious payments, and investigations that need attention.
          </p>
        </div>

        {/* Operational Status Pill & Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors disabled:opacity-50"
            title="Fetch latest API snapshot"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs" aria-label="System service health">
        {[
          ['API', healthUnavailable ? 'Unavailable' : health?.services?.api === 'operational' ? 'Healthy' : 'Unknown'],
          ['Database', health?.services?.database === 'connected' ? 'Healthy' : health?.services?.database === 'disconnected' ? 'Unavailable' : 'Unknown'],
          ['ML service', health?.services?.mlService === 'connected' ? 'Healthy' : health?.services?.mlService === 'degraded' ? 'Degraded' : health?.services?.mlService === 'unavailable' ? 'Unavailable' : 'Unknown'],
        ].map(([label, state]) => (
          <span key={label}>
            <span className="text-slate-400">{label}: </span>
            <span className={
              state === 'Healthy' ? 'text-emerald-300' :
              state === 'Degraded' ? 'text-amber-300' :
              state === 'Unavailable' ? 'text-rose-300' : 'text-slate-400'
            }>{state}</span>
          </span>
        ))}
        {health?.timestamp && <span className="text-slate-500">Checked {formatDistanceToNow(new Date(health.timestamp), { addSuffix: true })}</span>}
      </div>

      {dashboardError && (
        <div role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {dashboardError} Use Refresh to try again.
        </div>
      )}

      {/* Primary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              title="Total Transactions"
              value={summary.totalTx?.toLocaleString() ?? '—'}
              subtext="Payments monitored"
              icon={ArrowLeftRight}
              variant="default"
            />
            <MetricCard
              title="Suspicious Transactions"
              value={flaggedCount?.toLocaleString() ?? '—'}
              subtext={flaggedRatio ? `${flaggedRatio} of all transactions` : 'Assessment data unavailable'}
              icon={AlertTriangle}
              variant="warning"
            />
            <MetricCard
              title="Money at Risk"
              value={summary.moneyAtRisk === undefined ? '—' : formatINR(summary.moneyAtRisk, summary.currency || 'INR')}
              subtext={summary.currencyMigrationRequired ? 'Mixed currencies require review' : 'Exposure from flagged payments'}
              icon={IndianRupee}
              variant="danger"
            />
            <MetricCard
              title="Open Investigations"
              value={summary.openCases?.toLocaleString() ?? '—'}
              subtext="Cases still in progress"
              icon={FolderOpen}
              variant="intelligence"
            />
          </>
        )}
      </div>

      {/* 4. Active Threats Panel (Section 12) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide font-mono">
              ACTIVE THREATS & HIGH-PRIORITY ALERTS
            </h2>
            <span className="text-xs font-mono text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
              {dashboardError ? '—' : activeThreats.length} Requiring Attention
            </span>
          </div>
          <Link
            to="/alerts?severity=critical"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            Open Threat Center <ExternalLink size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : dashboardError ? (
          <p role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-6 text-center text-sm text-rose-200">
            Priority alerts could not be loaded. Use Refresh to try again.
          </p>
        ) : activeThreats.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={ShieldCheck}
              title="No critical active threats"
              description="Your detection engine is actively monitoring incoming transactions. No unresolved critical alerts require immediate intervention."
              action={
                <Link
                  to="/alerts"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  View Historical Alerts
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeThreats.map((alt) => (
              <ThreatCard
                key={alt._id}
                alert={alt}
                onBlockTransaction={handleBlockTransaction}
                isBlocking={blockingId === alt.transactionId?._id}
              />
            ))}
          </div>
        )}
      </div>

      {/* 5. Charts Row: Fraud Detection Trend & Risk Distribution (Sections 13 & 14) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Fraud Detection Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>FRAUD DETECTION TREND (14-DAY SLIDING WINDOW)</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily transaction velocity plotted against flagged heuristic deviations
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" /> Total Volume
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Flagged Anomalies
              </span>
            </div>
          </CardHeader>

          {loading ? (
            <Skeleton className="h-48" />
          ) : volumeData.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-12">
              No historical trend data recorded yet.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={volumeData}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="flagGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="_id"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(v) => v?.slice(5)}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#volGrad)"
                    name="Total Transactions"
                  />
                  <Area
                    type="monotone"
                    dataKey="flagged"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#flagGrad)"
                    name="Flagged / Suspicious"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">
                  14-Day Cumulative: <strong className="text-slate-200">{totalPeriodCount}</strong> txns,{' '}
                  <strong className="text-amber-400">{totalPeriodFlagged}</strong> flagged
                </span>
                <span className="font-mono text-cyan-400">
                  Anomaly Rate: <strong>                  {periodAnomalyRatio ?? '—'}</strong>
                </span>
              </div>
            </>
          )}
        </Card>

        {/* Current Threat Distribution */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>CURRENT THREAT DISTRIBUTION</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Transactions classified by risk score severity</p>
            </div>
          </CardHeader>

          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="space-y-4 pt-1">
              {[
                { level: 'critical', label: 'Critical Risk (80-100)', color: '#ef4444', bar: 'bg-rose-500' },
                { level: 'high', label: 'High Risk (55-79)', color: '#f97316', bar: 'bg-orange-500' },
                { level: 'medium', label: 'Medium Risk (25-54)', color: '#f59e0b', bar: 'bg-amber-500' },
                { level: 'low', label: 'Low Risk (0-24)', color: '#10b981', bar: 'bg-emerald-500' },
              ].map((item) => {
                const count = riskDist.find((r) => r._id === item.level)?.count || 0;
                const pct = totalTx > 0 ? ((count / totalTx) * 100).toFixed(1) : 0;
                return (
                  <div key={item.level} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </span>
                      <span className="font-mono font-bold text-slate-200">
                        {count} <span className="text-slate-500 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
                Transactions by risk category. Total: {totalTx?.toLocaleString() ?? '—'}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 6. Live Fraud Activity Stream & High-Risk Transactions (Section 11) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Live Ingestion Feed */}
        <Card padding={false}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-emerald-400 animate-pulse" />
              <h3 className="text-sm font-semibold text-slate-200">LIVE TRANSACTION STREAM</h3>
            </div>
            <Link to="/transactions" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
              View All Monitor
            </Link>
          </div>

          {loading ? (
            <div className="p-4">
              <Skeleton className="h-44" />
            </div>
          ) : transactionError ? (
            <p role="alert" className="px-4 py-8 text-sm text-rose-300">{transactionError}</p>
          ) : liveStream.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">No live transactions available.</p>
          ) : (
            <div className="divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto">
              {liveStream.map((tx) => (
                <Link
                  key={tx._id}
                  to={`/transactions/${tx._id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-cyan-400 font-semibold">{tx.transactionId}</span>
                      <StatusBadge status={tx.status} size="sm" showIcon={false} />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {tx.customerId} · <strong className="text-slate-200">{formatINR(tx.amount, tx.currency || '')}</strong> · via{' '}
                      <span className="capitalize">{tx.channel?.replace(/_/g, ' ') || 'card'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <RiskBadge level={tx.riskLevel} score={tx.riskScore} size="sm" />
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline whitespace-nowrap">
                      {tx.timestamp ? formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true }) : ''}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent High-Risk Transactions with Quick Intercept */}
        <Card padding={false}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-rose-400" />
              <h3 className="text-sm font-semibold text-slate-200">RECENT HIGH-RISK DETECTIONS</h3>
            </div>
            <Link to="/transactions?riskLevel=high" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
              Filter High Risk
            </Link>
          </div>

          {loading ? (
            <div className="p-4">
              <Skeleton className="h-44" />
            </div>
          ) : dashboardError ? (
            <p role="alert" className="px-4 py-8 text-sm text-rose-300">{dashboardError}</p>
          ) : !stats?.recentHighRiskTx?.length ? (
            <p className="text-xs text-slate-500 text-center py-10">No recent high-risk transactions detected.</p>
          ) : (
            <div className="divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto">
              {stats.recentHighRiskTx.map((tx) => (
                <div
                  key={tx._id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/transactions/${tx._id}`}
                        className="text-xs font-mono text-cyan-400 hover:underline font-bold"
                      >
                        {tx.transactionId}
                      </Link>
                      <RiskBadge level={tx.riskLevel} score={tx.riskScore} size="sm" />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {tx.customerId} · <span className="text-slate-100 font-semibold">{formatINR(tx.amount, tx.currency || '')}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {tx.status !== 'blocked' ? (
                      <button
                        onClick={() => handleBlockTransaction(tx._id)}
                        disabled={blockingId === tx._id}
                        className="px-2 py-1 text-[11px] font-medium rounded-md text-rose-400 bg-rose-950/60 border border-rose-800/60 hover:bg-rose-900/60 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <Ban size={10} /> Block
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60 font-semibold">
                        BLOCKED
                      </span>
                    )}

                    <Link
                      to={`/transactions/${tx._id}`}
                      className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                      title="Inspect Transaction"
                    >
                      <Eye size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
