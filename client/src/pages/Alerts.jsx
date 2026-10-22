import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Select } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, Skeleton } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { formatDistanceToNow } from 'date-fns';
import { formatINR } from '../utils/currency';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', severity: '' });
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');

  const updateFilter = (key, val) => {
    setLoading(true);
    setError('');
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;

      const res = await api.get('/alerts', { params });
      if (!Array.isArray(res.data?.data)) {
        throw new Error('The alert service returned an unexpected response.');
      }
      setAlerts(res.data.data);
      setMeta(res.data.meta || null);

      try {
        const dashRes = await api.get('/analytics/dashboard');
        const summary = dashRes.data?.data?.overview;
        setCounts(summary ? {
          critical: summary.criticalAlerts,
          high: summary.highAlerts,
          open: summary.openAlerts,
        } : null);
      } catch {
        setCounts(null);
      }
    } catch (requestError) {
      setAlerts([]);
      setMeta(null);
      setCounts(null);
      setError(
        requestError?.response?.data?.message
          || requestError?.message
          || 'Unable to load threat alerts. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const refreshAlerts = () => {
    setLoading(true);
    setError('');
    fetchAlerts();
  };

  return (
    <div className="space-y-6">
      {/* 1. Threat Center Header */}
      <PageHeader
        title="Threat Center"
        description="Review alerts raised by payment monitoring, understand the evidence, and decide what to investigate."
        actions={(
          <button
            onClick={refreshAlerts}
            type="button"
            aria-label="Refresh threat alerts"
            className="p-2.5 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
        )}
      />

      {/* 2. Urgent Threat Metrics Strip (Section 21) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-red-900/60 bg-gradient-to-br from-red-950/40 to-slate-900/90 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-red-400 font-semibold mb-1">
            Critical Threats
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-300">{counts?.critical ?? '—'}</span>
            <span className="text-[10px] font-mono text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-800">
              Urgent
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-orange-900/50 bg-gradient-to-br from-orange-950/30 to-slate-900/90 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-orange-400 font-semibold mb-1">
            High Severity
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-orange-300">
              {counts?.high ?? '—'}
            </span>
            <span className="text-[10px] font-mono text-orange-400 bg-orange-950 px-1.5 py-0.5 rounded border border-orange-800">
              Monitor
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-sky-900/40 bg-gradient-to-br from-sky-950/25 to-slate-900/90 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold mb-1">
            Total Open Threats
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-sky-300">{counts?.open ?? '—'}</span>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800">
              Queue
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
            All Monitored Alerts
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-slate-200">{meta?.total ?? (error ? '—' : 0)}</span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              Historical
            </span>
          </div>
        </div>
      </div>

      {!counts && !loading && !error && (
        <p className="text-xs text-slate-500">
          Threat summary analytics are unavailable; alert records remain available below.
        </p>
      )}

      {/* 3. Search & Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search alerts by title or transaction ID…"
            value={search}
            onChange={(e) => {
              setLoading(true);
              setError('');
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <Select
          value={filters.severity}
          onChange={(e) => updateFilter('severity', e.target.value)}
          className="w-36 text-xs"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical Only</option>
          <option value="high">High Severity</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>

        <Select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="w-40 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="open">Open Threats</option>
          <option value="in_review">In Review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="false_positive">False Positive</option>
        </Select>
      </div>

      {/* 4. Threat Cards List (Section 21 & 22) */}
      <div className="space-y-3">
        {error ? (
          <div role="alert" className="p-8 rounded-2xl bg-slate-900 border border-rose-900/60 text-center">
            <p className="text-sm font-semibold text-rose-300">Threat alerts could not be loaded</p>
            <p className="mt-2 text-xs text-slate-400">{error}</p>
            <button
              type="button"
              onClick={refreshAlerts}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800">
            <EmptyState
              icon={ShieldCheck}
              title="No threats match current criteria"
              description="No active alerts match your search or filter configuration. Adjust the filters to view historical alerts."
            />
          </div>
        ) : (
          alerts.map((a) => {
            const isCritical = a.severity === 'critical';
            const tx = a.transactionId || {};
            return (
              <div
                key={a._id}
                className={`p-5 rounded-2xl border transition-all ${
                  isCritical
                    ? 'bg-gradient-to-r from-red-950/30 via-slate-900 to-slate-900 border-red-900/60 hover:border-red-800'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Threat Title & Details */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RiskBadge level={a.severity} size="sm" />
                      <StatusBadge status={a.status} size="sm" />
                      <span className="text-xs font-mono font-semibold text-slate-400">
                        {a.alertId}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        · {a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : ''}
                      </span>
                    </div>

                    <Link
                      to={`/alerts/${a._id}`}
                      className="text-base font-bold text-white hover:text-cyan-400 transition-colors block"
                    >
                      {a.title}
                    </Link>

                    <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                      {a.description || 'No additional threat description provided.'}
                    </p>

                    {/* Triggered Rule Chips */}
                    {a.triggeredRules && a.triggeredRules.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Triggers:</span>
                        {a.triggeredRules.slice(0, 3).map((r, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                          >
                            {r.rule} <strong className="text-amber-400">+{r.score}</strong>
                          </span>
                        ))}
                        {a.triggeredRules.length > 3 && (
                          <span className="text-[11px] font-mono text-cyan-400">
                            +{a.triggeredRules.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Transaction Exposure & Quick Action */}
                  <div className="flex items-center gap-4 lg:gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    {tx.amount !== undefined && (
                      <div className="text-left lg:text-right">
                        <p className="text-[10px] font-mono uppercase text-slate-500">Exposure</p>
                        <p className="text-lg font-bold font-mono text-slate-100">
                          {formatINR(tx.amount, tx.currency || '')}
                        </p>
                        <p className="text-[11px] font-mono text-cyan-400">
                          Cust: {tx.customerId || '—'}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/alerts/${a._id}`}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1.5 shadow-md shadow-cyan-950"
                      >
                        Investigate <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!error && (
        <Pagination
          meta={meta}
          onPageChange={(nextPage) => {
            setLoading(true);
            setError('');
            setPage(nextPage);
          }}
        />
      )}
    </div>
  );
}
