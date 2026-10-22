import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  Eye,
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
        const summary = dashRes.data?.data?.summary;
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
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-700' : ''} />
          </button>
        )}
      />

      {/* 2. Urgent Threat Metrics Strip (Section 21) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-red-700 font-semibold mb-1">
            Critical Threats
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-700">{counts?.critical ?? '—'}</span>
            <span className="text-[10px] font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
              Urgent
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-orange-700 font-semibold mb-1">
            High Severity
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-orange-700">
              {counts?.high ?? '—'}
            </span>
            <span className="text-[10px] font-mono text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
              Monitor
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-sky-700 font-semibold mb-1">
            Total Open Threats
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-sky-700">{counts?.open ?? '—'}</span>
            <span className="text-[10px] font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
              Queue
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white/90 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold mb-1">
            All Monitored Alerts
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-slate-800">{meta?.total ?? (error ? '—' : 0)}</span>
            <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
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
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
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
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Alert register */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div role="alert" className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-700">Threat alerts could not be loaded</p>
            <p className="mt-2 text-xs text-slate-600">{error}</p>
            <button
              type="button"
              onClick={refreshAlerts}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : alerts.length === 0 && !loading ? (
          <EmptyState
            icon={ShieldCheck}
            title="No threats match current criteria"
            description="No active alerts match your search or filter configuration. Adjust the filters to view historical alerts."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3">Severity</th>
                  <th scope="col" className="px-4 py-3">Alert / reason</th>
                  <th scope="col" className="px-4 py-3">Transaction</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Detected</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={7} className="p-4"><Skeleton className="h-64" /></td></tr>
                ) : alerts.map((alertRecord) => {
                  const tx = alertRecord.transactionId || {};
                  const reason = alertRecord.triggeredRules?.[0]?.description
                    || alertRecord.description
                    || alertRecord.title
                    || 'No detection reason recorded.';
                  return (
                    <tr key={alertRecord._id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <RiskBadge level={alertRecord.severity} size="sm" />
                      </td>
                      <td className="max-w-sm px-4 py-3.5">
                        <Link
                          to={`/alerts/${alertRecord._id}`}
                          className="font-semibold text-slate-900 hover:text-blue-700"
                        >
                          {alertRecord.alertId}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{reason}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {tx._id ? (
                          <Link to={`/transactions/${tx._id}`} className="font-mono text-xs text-blue-700 hover:underline">
                            {tx.transactionId || 'View transaction'}
                          </Link>
                        ) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">
                        {tx.amount !== undefined ? formatINR(tx.amount, tx.currency || '') : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <StatusBadge status={alertRecord.status} size="sm" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                        {alertRecord.createdAt ? formatDistanceToNow(new Date(alertRecord.createdAt), { addSuffix: true }) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <Link
                          to={`/alerts/${alertRecord._id}`}
                          aria-label={`Review alert ${alertRecord.alertId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye size={14} /> Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-200 px-4 pb-3 pt-2">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </div>

    </div>
  );
}
