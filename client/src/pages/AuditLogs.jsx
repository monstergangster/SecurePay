import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, RefreshCw, Search, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { Select } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (action) params.action = action;
      const res = await api.get('/audit', { params });
      setLogs(res.data.data || []);
      setMeta(res.data.meta);
    } catch {
      toast.error('Failed to load security audit trail');
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Security Audit Trail</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
              IMMUTABLE LOG
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Cryptographically timestamped log of analyst reviews, policy changes, authentication, and remediation events.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
        </button>
      </div>

      {/* 2. Action Filter */}
      <div className="flex gap-2">
        <Select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="w-72 text-xs"
        >
          <option value="">All Audited Security Actions</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          <option value="LOGOUT">LOGOUT</option>
          <option value="USER_CREATED">USER_CREATED</option>
          <option value="USER_UPDATED">USER_UPDATED</option>
          <option value="RULE_UPDATED">RULE_UPDATED</option>
          <option value="TRANSACTION_CREATED">TRANSACTION_CREATED</option>
          <option value="ALERT_UPDATED">ALERT_UPDATED</option>
          <option value="CASE_CREATED">CASE_CREATED</option>
          <option value="CASE_UPDATED">CASE_UPDATED</option>
          <option value="TRANSACTION_IMPORT">TRANSACTION_IMPORT</option>
        </Select>
      </div>

      {/* 3. Audit Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Timestamp (UTC)</th>
                <th className="px-5 py-3.5">Actor Identity</th>
                <th className="px-5 py-3.5">Action Code</th>
                <th className="px-5 py-3.5">Target Entity</th>
                <th className="px-5 py-3.5">Payload Context</th>
                <th className="px-5 py-3.5">Network IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <TableSkeleton rows={8} cols={6} />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ScrollText}
                      title="No audit entries found"
                      description="Administrative and forensic actions are recorded immutably in this audit log."
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap text-[11px]">
                      {log.createdAt ? format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss') : '—'}
                    </td>

                    <td className="px-5 py-3.5 text-slate-200">
                      <span>{log.actor?.name || 'System Actor'}</span>
                      {log.actorRole && (
                        <span className="ml-1.5 text-[10px] text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">
                          {log.actorRole}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-bold text-cyan-300">
                      {log.action}
                    </td>

                    <td className="px-5 py-3.5 text-slate-300">
                      {log.entity} {log.entityId && <span className="text-slate-500 font-normal">[{log.entityId}]</span>}
                    </td>

                    <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate text-[11px]">
                      {JSON.stringify(log.details || {})}
                    </td>

                    <td className="px-5 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.ipAddress || '127.0.0.1'}
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
