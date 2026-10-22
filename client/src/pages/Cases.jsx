import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  FolderOpen,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Select, Input, Textarea } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const NewCaseModal = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/cases', form);
      toast.success('Investigation case opened successfully.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open New Investigation Case">
      {error && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Investigation Title *"
          value={form.title}
          onChange={(e) => upd('title', e.target.value)}
          placeholder="E.g., Suspicious high-value velocity burst - Cust 002"
          required
        />
        <Select label="Priority Level" value={form.priority} onChange={(e) => upd('priority', e.target.value)}>
          <option value="critical">Critical Priority</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </Select>
        <Textarea
          label="Initial Case Findings & Context"
          value={form.description}
          onChange={(e) => upd('description', e.target.value)}
          rows={4}
          placeholder="Document reason for case creation, affected accounts, and initial remediation..."
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            Create Investigation Case
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [showNew, setShowNew] = useState(false);

  const upd = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = { page, limit: 15 };
      if (search) p.search = search;
      if (filters.status) p.status = filters.status;
      if (filters.priority) p.priority = filters.priority;
      const res = await api.get('/cases', { params: p });
      setCases(res.data.data || []);
      setMeta(res.data.meta);
    } catch {
      setCases([]);
      setMeta(null);
      setError('Unable to load investigation cases. Check your connection and try again.');
      toast.error('Failed to load investigation cases');
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <PageHeader
        title="Cases"
        description="Track investigations from initial review through resolution, with evidence and analyst notes in one place."
        actions={(
          <>
          <Button size="sm" onClick={() => setShowNew(true)} className="text-xs">
            <Plus size={14} /> Open case
          </Button>
          <button
            onClick={fetchCases}
            type="button"
            aria-label="Refresh cases"
            className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-700' : ''} />
          </button>
          </>
        )}
      />
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {/* 2. Search & Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search investigation cases by title or case ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Select
          value={filters.status}
          onChange={(e) => upd('status', e.target.value)}
          className="w-40 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>

        <Select
          value={filters.priority}
          onChange={(e) => upd('priority', e.target.value)}
          className="w-36 text-xs"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
      </div>

      {/* 3. Cases Table / List */}
      <div className="bg-white/90 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-mono text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Case Title & ID</th>
                <th className="px-5 py-3.5">Linked Transaction</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Outcome</th>
                <th className="px-5 py-3.5">Assigned Investigator</th>
                <th className="px-5 py-3.5">Last Activity</th>
                <th className="px-5 py-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <TableSkeleton rows={6} cols={8} />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center">
                    <p className="text-sm text-rose-700">{error}</p>
                    <button type="button" onClick={fetchCases} className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-700">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={FolderOpen}
                      title="No investigation cases match your filters"
                      description="Create a case directly from an alert, a transaction, or use the button above."
                    />
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-100/40 transition-colors">
                    <td className="px-5 py-3.5 max-w-sm">
                      <Link
                        to={`/cases/${c._id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-700 transition-colors line-clamp-1 block"
                      >
                        {c.title}
                      </Link>
                      <p className="text-[11px] text-slate-600 font-mono mt-0.5">{c.caseId}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      {c.transactions?.length ? (
                        <Link
                          to={`/transactions/${c.transactions[0]._id}`}
                          className="font-mono text-blue-700 hover:underline"
                        >
                          {c.transactions[0].transactionId || 'View transaction'}
                          {c.transactions.length > 1 && (
                            <span className="ml-1 text-slate-500">+{c.transactions.length - 1}</span>
                          )}
                        </Link>
                      ) : <span className="text-slate-500">—</span>}
                    </td>

                    <td className="px-5 py-3.5">
                      <RiskBadge level={c.priority} size="sm" />
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusBadge status={c.status} size="sm" />
                    </td>

                    <td className="px-5 py-3.5">
                      {c.outcome ? (
                        <StatusBadge status={c.outcome} size="sm" />
                      ) : (
                        <span className="text-[11px] font-mono text-slate-600">Pending Filing</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-slate-700 font-medium">
                      {c.assignedTo?.name || 'Unassigned Queue'}
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {c.updatedAt ? formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true }) : '—'}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/cases/${c._id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-50 inline-flex items-center gap-1 transition-colors"
                      >
                        Workspace <ArrowRight size={11} />
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

      <NewCaseModal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={() => {
          setShowNew(false);
          fetchCases();
        }}
      />
    </div>
  );
}
