import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, RefreshCw, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { Select } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatINR } from '../utils/currency';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = { page, limit: 15 };
      if (search) p.search = search;
      if (riskLevel) p.riskLevel = riskLevel;
      const res = await api.get('/customers', { params: p });
      setCustomers(res.data.data || []);
      setMeta(res.data.meta);
    } catch {
      setCustomers([]);
      setMeta(null);
      setError('Unable to load customer profiles. Check your connection and try again.');
      toast.error('Failed to load customer profiles');
    } finally {
      setLoading(false);
    }
  }, [page, search, riskLevel]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <PageHeader
        title="Customers"
        description="Review customer activity, transaction patterns, and recorded risk assessments."
        actions={(
          <button
            onClick={fetchCustomers}
            type="button"
            aria-label="Refresh customers"
            className="p-2.5 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
        )}
      />
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

      {/* 2. Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Customer ID (e.g. CUST-001)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <Select
          value={riskLevel}
          onChange={(e) => {
            setRiskLevel(e.target.value);
            setPage(1);
          }}
          className="w-44 text-xs"
        >
          <option value="">All Risk Categories</option>
          <option value="critical">Critical Risk</option>
          <option value="high">High Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="low">Low Risk</option>
        </Select>
      </div>

      {/* 3. Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Customer Identifier</th>
                <th className="px-5 py-3.5">Risk Rating</th>
                <th className="px-5 py-3.5">Cumulative Volume</th>
                <th className="px-5 py-3.5">Transactions</th>
                <th className="px-5 py-3.5">Flagged</th>
                <th className="px-5 py-3.5">Last Seen</th>
                <th className="px-5 py-3.5 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <TableSkeleton rows={7} cols={7} />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center">
                    <p className="text-sm text-rose-300">{error}</p>
                    <button type="button" onClick={fetchCustomers} className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Users}
                      title="No customer entities found"
                      description="Customer baselines are automatically established and updated as transactions are ingested."
                    />
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/customers/${c.customerId}`}
                        className="font-mono text-cyan-400 hover:text-cyan-300 font-bold tracking-tight block"
                      >
                        {c.customerId}
                      </Link>
                      {c.displayName && <p className="text-[11px] text-slate-400 mt-0.5">{c.displayName}</p>}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={c.riskLevel} score={c.riskScore} size="sm" />
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-slate-100">
                      {formatINR(c.totalTransactionAmount, c.currency || '')}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-300">
                      {c.transactionCount?.toLocaleString() || 0}
                    </td>

                    <td className="px-5 py-3.5">
                      {c.flaggedTransactionCount > 0 ? (
                        <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                          {c.flaggedTransactionCount} flagged
                        </span>
                      ) : (
                        <span className="font-mono text-slate-500">0</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {c.lastTransactionAt ? format(new Date(c.lastTransactionAt), 'MMM dd, yyyy') : '—'}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/customers/${c.customerId}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 hover:bg-cyan-900/60 inline-flex items-center gap-1 transition-colors"
                      >
                        Profile <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-4 pt-2">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
