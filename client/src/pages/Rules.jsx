import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Edit2,
} from 'lucide-react';
import api from '../services/api';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import toast from 'react-hot-toast';
import { formatINR } from '../utils/currency';

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRule, setSelectedRule] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ weight: 0, threshold: '', isActive: true, description: '' });
  const [saving, setSaving] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/rules');
      setRules(res.data.data || []);
    } catch {
      setRules([]);
      setError('Unable to load detection rules. Check your access and connection, then try again.');
      toast.error('Failed to load detection engine heuristics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const openEdit = (rule) => {
    setSelectedRule(rule);
    setForm({
      weight: rule.weight,
      threshold: rule.threshold !== undefined && rule.threshold !== null ? rule.threshold : '',
      isActive: rule.isActive,
      description: rule.description || '',
    });
    setShowEdit(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        weight: Number(form.weight),
        isActive: form.isActive,
        description: form.description,
      };
      if (form.threshold !== '') {
        payload.threshold = Number(form.threshold);
      }
      await api.put(`/rules/${selectedRule._id}`, payload);
      toast.success('Detection rule updated successfully.');
      setShowEdit(false);
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update rule');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = rules.filter((r) => r.isActive).length;
  const totalTriggers = rules.reduce((acc, r) => acc + (r.triggerCount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detection Rules"
        description="Review and adjust the rules that assess payment risk."
        actions={(
          <button
            type="button"
            onClick={fetchRules}
            aria-label="Refresh detection rules"
            className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-700' : ''} />
          </button>
        )}
      />
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {/* 2. Top Engine Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white/90 border border-slate-200">
          <p className="text-[11px] font-mono uppercase text-slate-600 font-semibold mb-1">Active Rules</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">
              {error ? '—' : activeCount} <span className="text-xs text-slate-500 font-normal">/ {error ? '—' : rules.length} configured</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/90 border border-slate-200">
          <p className="text-[11px] font-mono uppercase text-slate-600 font-semibold mb-1">Cumulative Triggers</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-700">{error ? '—' : totalTriggers.toLocaleString()}</span>
            <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              All Rules
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/90 border border-slate-200">
          <p className="text-[11px] font-mono uppercase text-slate-600 font-semibold mb-1">Scoring Mode</p>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-blue-700">Hybrid (Heuristics + ML)</span>
            <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              65 / 35 Blend
            </span>
          </div>
        </div>
      </div>

      {/* 3. Rules Table */}
      <div className="bg-white/90 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-mono text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Rule Identity & Logic</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Weight Impact</th>
                <th className="px-5 py-3.5">Threshold Parameter</th>
                <th className="px-5 py-3.5">Engine Status</th>
                <th className="px-5 py-3.5">Trigger Count</th>
                <th className="px-5 py-3.5 text-right">Configure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <TableSkeleton rows={6} cols={7} />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center">
                    <p className="text-sm text-rose-700">{error}</p>
                    <button type="button" onClick={fetchRules} className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-700">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Cpu}
                      title="No detection rules configured"
                      description="Initialize the default heuristic rule set to enable real-time risk scoring."
                    />
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-100/40 transition-colors">
                    <td className="px-5 py-3.5 max-w-sm">
                      <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                      <p className="text-[11px] font-mono text-blue-700 mt-0.5">{r.ruleId}</p>
                      {r.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">{r.description}</p>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono uppercase text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {r.category}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm font-bold text-amber-700">
                        +{r.weight} PTS
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-700">
                      {r.threshold !== undefined && r.threshold !== null
                        ? r.thresholdUnit === 'INR' ? formatINR(r.threshold) : `${r.threshold} ${r.thresholdUnit || ''}`
                        : 'Dynamic Parameters'}
                    </td>

                    <td className="px-5 py-3.5">
                      {r.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold font-mono">
                          <CheckCircle2 size={11} /> ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-semibold font-mono">
                          <XCircle size={11} /> DISABLED
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800">
                      {r.triggerCount?.toLocaleString() || 0}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)} className="text-xs">
                        <Edit2 size={12} className="mr-1" /> Configure
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rule Modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title={`Configure Detection Rule: ${selectedRule?.name || ''}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <span className="text-xs font-mono text-blue-700 font-bold block mb-1">
              {selectedRule?.ruleId}
            </span>
            <Textarea
              label="Rule Description & Rationale"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Risk Weight (0-100)"
              type="number"
              min="0"
              max="100"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              required
            />
            {selectedRule?.threshold !== undefined && (
              <Input
                label={`Threshold (${selectedRule.thresholdUnit || 'Value'})`}
                type="number"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              />
            )}
          </div>

          <Select
            label="Evaluation Status"
            value={form.isActive ? 'true' : 'false'}
            onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
          >
            <option value="true">Active (Evaluated on every incoming payment)</option>
            <option value="false">Disabled (Rule bypassed)</option>
          </Select>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              Save Rule Configuration
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
