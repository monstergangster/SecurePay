import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Edit2,
  Info,
} from 'lucide-react';
import api from '../services/api';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { formatINR } from '../utils/currency';

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ weight: 0, threshold: '', isActive: true, description: '' });
  const [saving, setSaving] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rules');
      setRules(res.data.data || []);
    } catch {
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
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Detection Engine</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
              REAL-TIME HEURISTICS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Configure automated transaction evaluation rules, anomaly weight contributions, and trigger thresholds.
          </p>
        </div>

        <button
          onClick={fetchRules}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
        </button>
      </div>

      {/* 2. Top Engine Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <p className="text-[11px] font-mono uppercase text-slate-400 font-semibold mb-1">Active Rules</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {activeCount} <span className="text-xs text-slate-500 font-normal">/ {rules.length} configured</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              Active
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <p className="text-[11px] font-mono uppercase text-slate-400 font-semibold mb-1">Cumulative Triggers</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-400">{totalTriggers.toLocaleString()}</span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              All Rules
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <p className="text-[11px] font-mono uppercase text-slate-400 font-semibold mb-1">Scoring Mode</p>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-cyan-400">Hybrid (Heuristics + ML)</span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
              65 / 35 Blend
            </span>
          </div>
        </div>
      </div>

      {/* 3. Rules Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Rule Identity & Logic</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Weight Impact</th>
                <th className="px-5 py-3.5">Threshold Parameter</th>
                <th className="px-5 py-3.5">Engine Status</th>
                <th className="px-5 py-3.5">Trigger Count</th>
                <th className="px-5 py-3.5 text-right">Configure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <TableSkeleton rows={6} cols={7} />
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
                  <tr key={r._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 max-w-sm">
                      <p className="text-sm font-semibold text-slate-100">{r.name}</p>
                      <p className="text-[11px] font-mono text-cyan-400 mt-0.5">{r.ruleId}</p>
                      {r.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{r.description}</p>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono uppercase text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        {r.category}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm font-bold text-amber-400">
                        +{r.weight} PTS
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-300">
                      {r.threshold !== undefined && r.threshold !== null
                        ? r.thresholdUnit === 'INR' ? formatINR(r.threshold) : `${r.threshold} ${r.thresholdUnit || ''}`
                        : 'Dynamic Parameters'}
                    </td>

                    <td className="px-5 py-3.5">
                      {r.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60 font-semibold font-mono">
                          <CheckCircle2 size={11} /> ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 font-semibold font-mono">
                          <XCircle size={11} /> DISABLED
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-slate-200">
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
            <span className="text-xs font-mono text-cyan-400 font-bold block mb-1">
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
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
