import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  ArrowLeftRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Ban,
  Eye,
  Calendar,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Select, Input } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatINR } from '../utils/currency';

const NewTxModal = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    customerId: '',
    amount: '',
    currency: 'INR',
    channel: 'card',
    merchantId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/transactions', { ...form, amount: parseFloat(form.amount), isDemo: true });
      toast.success('Transaction created and risk-assessed immediately.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ingest Simulated Transaction">
      {error && (
        <div className="mb-3 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Customer ID *"
          value={form.customerId}
          onChange={(e) => upd('customerId', e.target.value)}
          placeholder="CUST-001"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount *"
            type="number"
            value={form.amount}
            onChange={(e) => upd('amount', e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            required
          />
          <Input label="Currency" value="INR" readOnly />
        </div>
        <Select label="Payment Channel" value={form.channel} onChange={(e) => upd('channel', e.target.value)}>
          <option value="card">Card Payment</option>
          <option value="bank_transfer">Bank Wire Transfer</option>
          <option value="upi">UPI Real-Time</option>
          <option value="wallet">Digital Wallet</option>
          <option value="crypto">Cryptocurrency Asset</option>
          <option value="other">Other Channel</option>
        </Select>
        <Input
          label="Merchant Identifier"
          value={form.merchantId}
          onChange={(e) => upd('merchantId', e.target.value)}
          placeholder="MERCH-8821"
        />
        <p className="text-xs text-slate-400 leading-relaxed">
          Demo transaction flagged with high amount or rapid succession will dynamically trigger heuristic rules.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            Create & Assess
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default function Transactions() {
  const [txs, setTxs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [kpi, setKpi] = useState({ total: 0, approved: 0, flagged: 0, highRisk: 0, blocked: 0 });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    riskLevel: '',
    channel: '',
    dateFrom: '',
    dateTo: '',
  });

  const upd = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const p = { page, limit: 20 };
      if (filters.search) {
        p.transactionId = filters.search;
        p.customerId = filters.search;
      }
      if (filters.status) p.status = filters.status;
      if (filters.riskLevel) p.riskLevel = filters.riskLevel;
      if (filters.channel) p.channel = filters.channel;
      if (filters.dateFrom) p.dateFrom = filters.dateFrom;
      if (filters.dateTo) p.dateTo = filters.dateTo;

      const [res, dashRes] = await Promise.all([
        api.get('/transactions', { params: p }),
        api.get('/analytics/dashboard'),
      ]);

      setTxs(res.data.data || []);
      setMeta(res.data.meta);

      if (dashRes.data?.data?.summary) {
        const s = dashRes.data.data.summary;
        setKpi({
          total: s.totalTx || 0,
          approved: s.approvedTx || 0,
          flagged: s.flaggedTx || 0,
          highRisk: (s.flaggedTx || 0) + (s.blockedTx || 0),
          blocked: s.blockedTx || 0,
        });
      }
    } catch {
      toast.error('Failed to load transaction monitor data');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Transaction Monitor</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
              AUDITED FLOW
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time transaction surveillance, heuristic rule evaluations, and settlement interception.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowNew(true)} className="text-xs">
            <Plus size={14} /> Ingest Demo Tx
          </Button>
          <button
            onClick={fetchTransactions}
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. KPI Strip (Section 15) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <p className="text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">Total Monitored</p>
          <p className="text-2xl font-bold font-mono text-white">{kpi.total.toLocaleString()}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
          <p className="text-[10px] font-mono uppercase text-emerald-400 font-semibold mb-1">Normal / Approved</p>
          <p className="text-2xl font-bold font-mono text-emerald-300">{kpi.approved.toLocaleString()}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40">
          <p className="text-[10px] font-mono uppercase text-amber-400 font-semibold mb-1">Flagged Suspicious</p>
          <p className="text-2xl font-bold font-mono text-amber-300">{kpi.flagged.toLocaleString()}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-orange-950/20 border border-orange-900/40">
          <p className="text-[10px] font-mono uppercase text-orange-400 font-semibold mb-1">Elevated Risk</p>
          <p className="text-2xl font-bold font-mono text-orange-300">{kpi.highRisk.toLocaleString()}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-900/50">
          <p className="text-[10px] font-mono uppercase text-rose-400 font-semibold mb-1">Blocked Intercepts</p>
          <p className="text-2xl font-bold font-mono text-rose-300">{kpi.blocked.toLocaleString()}</p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Transaction ID or Customer ID…"
              value={filters.search}
              onChange={(e) => upd('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-xl border transition-colors ${
              showFilters
                ? 'bg-cyan-950 border-cyan-700 text-cyan-400 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Filter size={13} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
            <Select label="Status" value={filters.status} onChange={(e) => upd('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
              <option value="blocked">Blocked</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
            </Select>

            <Select label="Risk Level" value={filters.riskLevel} onChange={(e) => upd('riskLevel', e.target.value)}>
              <option value="">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </Select>

            <Select label="Channel" value={filters.channel} onChange={(e) => upd('channel', e.target.value)}>
              <option value="">All Channels</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="wallet">Wallet</option>
              <option value="crypto">Crypto</option>
            </Select>

            <Input
              label="From Date"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => upd('dateFrom', e.target.value)}
            />
            <Input
              label="To Date"
              type="date"
              value={filters.dateTo}
              onChange={(e) => upd('dateTo', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* 4. Transactions Table (Section 15) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Channel</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Risk Score</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <TableSkeleton rows={8} cols={8} />
                  </td>
                </tr>
              ) : txs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={ArrowLeftRight}
                      title="No transactions match your query"
                      description="Adjust your search filters or generate a test transaction using the demo button."
                    />
                  </td>
                </tr>
              ) : (
                txs.map((tx) => {
                  const isBlocked = tx.status === 'blocked';
                  const isFlagged = tx.status === 'flagged' || (tx.riskScore || 0) >= 55;
                  return (
                    <tr
                      key={tx._id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isBlocked
                          ? 'bg-rose-950/10'
                          : isFlagged
                          ? 'bg-amber-950/10'
                          : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/transactions/${tx._id}`}
                          className="font-mono text-cyan-400 hover:text-cyan-300 font-bold tracking-tight"
                        >
                          {tx.transactionId}
                        </Link>
                        {tx.isDemo && (
                          <span className="ml-1.5 text-[10px] font-mono text-slate-500">[demo]</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <Link
                          to={`/customers/${tx.customerId}`}
                          className="font-mono text-slate-300 hover:underline"
                        >
                          {tx.customerId}
                        </Link>
                      </td>

                      <td className="px-5 py-3.5 font-mono font-bold text-slate-100 whitespace-nowrap">
                        {formatINR(tx.amount, tx.currency || '')}
                      </td>

                      <td className="px-5 py-3.5 text-slate-400 capitalize font-medium">
                        {tx.channel?.replace(/_/g, ' ') || 'card'}
                      </td>

                      <td className="px-5 py-3.5">
                        <StatusBadge status={tx.status} size="sm" />
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <RiskBadge level={tx.riskLevel} size="sm" />
                          <span className="font-mono font-bold text-slate-300">
                            {tx.riskScore !== null && tx.riskScore !== undefined ? tx.riskScore : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {tx.timestamp ? format(new Date(tx.timestamp), 'MMM dd, HH:mm:ss') : '—'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/transactions/${tx._id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 inline-block transition-colors"
                          title="Open Transaction Intelligence"
                        >
                          <Eye size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-4 pt-2">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      </div>

      <NewTxModal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={() => {
          setShowNew(false);
          fetchTransactions();
        }}
      />
    </div>
  );
}
