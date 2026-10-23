import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  IndianRupee,
  Radio,
  ExternalLink,
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
  const riskDist = stats?.riskDistribution || [];
  const activeThreats = stats?.activeThreats || [];

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Command Center</h1>
          </div>
          <p className="text-xs text-slate-600">
            A clear view of service health, suspicious payments, and investigations that need attention.
          </p>
        </div>

        {/* Operational Status Pill & Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
            title="Fetch latest API snapshot"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-blue-700' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs" aria-label="System service health">
        {[
          ['API', healthUnavailable ? 'Unavailable' : health?.services?.api === 'operational' ? 'Healthy' : 'Unknown'],
          ['Database', health?.services?.database === 'connected' ? 'Healthy' : health?.services?.database === 'disconnected' ? 'Unavailable' : 'Unknown'],
          ['ML service', health?.services?.mlService === 'connected' ? 'Healthy' : health?.services?.mlService === 'degraded' ? 'Degraded' : health?.services?.mlService === 'unavailable' ? 'Unavailable' : 'Unknown'],
        ].map(([label, state]) => (
          <span key={label}>
            <span className="text-slate-600">{label}: </span>
            <span className={
              state === 'Healthy' ? 'text-emerald-700' :
              state === 'Degraded' ? 'text-amber-700' :
              state === 'Unavailable' ? 'text-rose-700' : 'text-slate-600'
            }>{state}</span>
          </span>
        ))}
        {health?.timestamp && <span className="text-slate-500">Checked {formatDistanceToNow(new Date(health.timestamp), { addSuffix: true })}</span>}
      </div>

      {dashboardError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
              title="Amount at Risk"
              value={summary.moneyAtRisk === undefined ? '—' : formatINR(summary.moneyAtRisk, summary.currency || 'INR')}
              subtext={summary.nonINRTransactionCount > 0
                ? `INR transactions only · ${summary.nonINRTransactionCount} non-INR excluded`
                : 'Exposure from flagged payments'}
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
            <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide font-mono">
              Critical alerts requiring attention
            </h2>
            <span className="text-xs font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              {dashboardError ? '—' : activeThreats.length} Requiring Attention
            </span>
          </div>
          <Link
            to="/alerts?severity=critical"
            className="text-xs text-blue-700 hover:text-blue-700 font-medium flex items-center gap-1"
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
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
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
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
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

      {/* Risk distribution */}
      <div className="grid grid-cols-1 gap-5">
        {/* Current Threat Distribution */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Risk distribution</CardTitle>
              <p className="text-xs text-slate-600 mt-0.5">Transactions classified by risk score severity</p>
            </div>
          </CardHeader>

          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="space-y-4 pt-1">
              {[
                { level: 'critical', label: 'Critical risk (80-100)', color: '#dc2626', bar: 'bg-red-600' },
                { level: 'high', label: 'High risk (55-79)', color: '#ea580c', bar: 'bg-orange-600' },
                { level: 'medium', label: 'Medium risk (25-54)', color: '#d97706', bar: 'bg-amber-600' },
                { level: 'low', label: 'Low risk (0-24)', color: '#16a34a', bar: 'bg-emerald-600' },
              ].map((item) => {
                const count = riskDist.find((r) => r._id === item.level)?.count || 0;
                const pct = totalTx > 0 ? ((count / totalTx) * 100).toFixed(1) : 0;
                return (
                  <div key={item.level} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {count} <span className="text-slate-500 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 text-center">
                Transactions by risk category. Total: {totalTx?.toLocaleString() ?? '—'}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recommended next steps</CardTitle>
            <p className="mt-0.5 text-xs text-slate-600">Priorities based on the latest dashboard records.</p>
          </div>
        </CardHeader>
        {dashboardError ? (
          <p className="text-sm text-slate-600">Recommendations are unavailable until dashboard data loads.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {(summary.criticalAlerts > 0 || summary.openAlerts > 0) && (
              <Link
                to="/alerts"
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                Review {summary.criticalAlerts || summary.openAlerts} open alert{(summary.criticalAlerts || summary.openAlerts) === 1 ? '' : 's'}
              </Link>
            )}
            {flaggedCount > 0 && (
              <Link
                to="/transactions"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Review {flaggedCount.toLocaleString()} suspicious transaction{flaggedCount === 1 ? '' : 's'}
              </Link>
            )}
            {summary.openCases > 0 && (
              <Link
                to="/cases"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Continue {summary.openCases} open investigation{summary.openCases === 1 ? '' : 's'}
              </Link>
            )}
            {!(summary.criticalAlerts > 0 || summary.openAlerts > 0 || flaggedCount > 0 || summary.openCases > 0) && (
              <p className="text-sm text-slate-600">No immediate actions are indicated by the available dashboard data.</p>
            )}
          </div>
        )}
      </Card>

      {/* Recent transactions */}
      <div className="grid grid-cols-1 gap-5">
        {/* Live Ingestion Feed */}
        <Card padding={false}>
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-emerald-700" />
              <h3 className="text-sm font-semibold text-slate-800">Recent transactions</h3>
            </div>
            <Link to="/transactions" className="text-xs text-blue-700 hover:text-blue-700 font-medium">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="p-4">
              <Skeleton className="h-44" />
            </div>
          ) : transactionError ? (
            <p role="alert" className="px-4 py-8 text-sm text-rose-700">{transactionError}</p>
          ) : liveStream.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">No live transactions available.</p>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto">
              {liveStream.map((tx) => (
                <Link
                  key={tx._id}
                  to={`/transactions/${tx._id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-100/40 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-700 font-semibold">{tx.transactionId}</span>
                      <StatusBadge status={tx.status} size="sm" showIcon={false} />
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">
                      {tx.customerId} · <strong className="text-slate-800">{formatINR(tx.amount, tx.currency || '')}</strong> · via{' '}
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
      </div>
    </div>
  );
}
