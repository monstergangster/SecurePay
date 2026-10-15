import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Select } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { formatINR } from '../utils/currency';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', severity: '' });
  const [counts, setCounts] = useState({ critical: 0, high: 0, medium: 0, open: 0 });

  const updateFilter = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;

      const res = await api.get('/alerts', { params });
      setAlerts(res.data.data || []);
      setMeta(res.data.meta);

      // Fetch summary counters from analytics for top threat strip
      const dashRes = await api.get('/analytics/dashboard');
      if (dashRes.data?.data?.summary) {
        const s = dashRes.data.data.summary;
        setCounts({
          critical: s.criticalAlerts || 0,
          high: s.openAlerts || 0,
          medium: (s.openAlerts || 0) - (s.criticalAlerts || 0),
          open: s.openAlerts || 0,
        });
      }
    } catch {
      toast.error('Failed to load threat center records');
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return (
    <div className="space-y-6">
      {/* 1. Threat Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Threat Center</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-red-950 text-red-400 border border-red-800">
              ACTIVE VECTORS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Deduplicated security alerts prioritized by anomaly severity and financial exposure.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
        </button>
      </div>

      {/* 2. Urgent Threat Metrics Strip (Section 21) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-red-900/60 bg-gradient-to-br from-red-950/40 to-slate-900/90 shadow-sm">
          <p className="text-[11px] font-mono uppercase tracking-wider text-red-400 font-semibold mb-1">
            Critical Threats
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-300">{counts.critical}</span>
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
              {Math.max(0, counts.open - counts.critical)}
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
            <span className="text-2xl font-bold font-mono text-sky-300">{counts.open}</span>
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
            <span className="text-2xl font-bold font-mono text-slate-200">{meta?.total || 0}</span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              Historical
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search alerts by title or transaction ID…"
            value={search}
            onChange={(e) => {
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
        {loading ? (
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
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
