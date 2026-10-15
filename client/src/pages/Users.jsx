import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, UserCog, RefreshCw, CheckCircle2, XCircle, Shield, Lock } from 'lucide-react';
import api from '../services/api';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'analyst' });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch {
      toast.error('Failed to load user access accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/users', form);
      toast.success('Analyst / Administrator account provisioned.');
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'analyst' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user account');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserActive = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      toast.success(`Account for ${user.name} ${user.isActive ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status toggle failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">User & Role Management</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-950 text-purple-400 border border-purple-800">
              RBAC ACCESS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Provision and audit credentials for fraud analysts and platform administrators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowAdd(true)} className="text-xs">
            <UserPlus size={14} /> Provision Account
          </Button>
          <button
            onClick={fetchUsers}
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Users Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Personnel Name & Email</th>
                <th className="px-5 py-3.5">Role Scope</th>
                <th className="px-5 py-3.5">Access State</th>
                <th className="px-5 py-3.5">Last Authentication</th>
                <th className="px-5 py-3.5">Created Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <TableSkeleton rows={4} cols={6} />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={UserCog}
                      title="No personnel accounts found"
                      description="Provision initial analyst accounts using the button above."
                    />
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-slate-100">{u.name}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{u.email}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusBadge status={u.role} size="sm" showIcon={false} />
                    </td>

                    <td className="px-5 py-3.5">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-800/60">
                          <CheckCircle2 size={11} /> ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-rose-400 bg-rose-950/60 px-2.5 py-0.5 rounded-md border border-rose-800/60">
                          <XCircle size={11} /> REVOKED
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {u.lastLogin ? format(new Date(u.lastLogin), 'MMM dd, HH:mm') : 'No recorded login'}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {u.createdAt ? format(new Date(u.createdAt), 'MMM dd, yyyy') : '—'}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant={u.isActive ? 'outline' : 'secondary'}
                        onClick={() => toggleUserActive(u)}
                        className="text-xs"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Provision Personnel Account">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Full Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sarah Jenkins"
            required
          />
          <Input
            label="Email Address *"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="s.jenkins@securepay.dev"
            required
          />
          <Input
            label="Initial Password *"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
          />
          <Select
            label="Role Authorization Scope *"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="analyst">Fraud Analyst (Investigation & Alerts)</option>
            <option value="admin">Administrator (Full System, Rules, and Policies)</option>
          </Select>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Provision Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
