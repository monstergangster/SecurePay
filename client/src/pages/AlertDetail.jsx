import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  ExternalLink,
  ShieldAlert,
  FolderOpen,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { formatINR } from '../utils/currency';

export default function AlertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [showCase, setShowCase] = useState(false);
  const [caseForm, setCaseForm] = useState({ title: '', description: '', priority: 'high' });
  const [creatingCase, setCreatingCase] = useState(false);

  const fetchAlert = async () => {
    try {
      const res = await api.get(`/alerts/${id}`);
      setAlert(res.data.data);
      setNewStatus(res.data.data.status);
    } catch {
      toast.error('Failed to load threat details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlert();
  }, [id]);

  const updateStatus = async () => {
    setUpdating(true);
    try {
      await api.put(`/alerts/${id}`, { status: newStatus });
      toast.success(
        newStatus === 'resolved'
          ? 'Alert marked as resolved.'
          : 'Threat status updated successfully.'
      );
      fetchAlert();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    try {
      await api.post(`/alerts/${id}/comments`, { text: comment });
      setComment('');
      setShowComment(false);
      toast.success('Investigation comment recorded.');
      fetchAlert();
    } catch {
      toast.error('Failed to record comment');
    }
  };

  const createCase = async () => {
    if (!caseForm.title.trim()) return;
    setCreatingCase(true);
    try {
      const res = await api.post('/cases', {
        title: caseForm.title,
        description: caseForm.description,
        alertId: id,
        priority: caseForm.priority || (alert.severity === 'critical' ? 'critical' : 'high'),
      });
      toast.success('Investigation case created.');
      navigate(`/cases/${res.data.data._id}`);
    } catch {
      toast.error('Failed to create case');
    } finally {
      setCreatingCase(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!alert) return <div className="p-8 text-center text-slate-400">Threat alert not found.</div>;

  const tx = alert.transactionId || {};
  const isCritical = alert.severity === 'critical';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <Link
            to="/alerts"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-tight">{alert.title}</h1>
              <RiskBadge level={alert.severity} size="sm" />
              <StatusBadge status={alert.status} size="sm" />
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Alert Identifier: {alert.alertId}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Details & Rules & Comments */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>THREAT ASSESSMENT OVERVIEW</CardTitle>
            </CardHeader>
            <p className="text-sm text-slate-300 leading-relaxed mb-5">
              {alert.description || 'No detailed narrative recorded.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Underlying Transaction</p>
                {tx._id ? (
                  <Link
                    to={`/transactions/${tx._id}`}
                    className="font-mono text-cyan-400 hover:underline flex items-center gap-1 mt-0.5 font-bold"
                  >
                    {tx.transactionId} <ExternalLink size={11} />
                  </Link>
                ) : (
                  <span className="font-mono text-slate-400">—</span>
                )}
              </div>

              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Financial Exposure</p>
                <p className="font-mono text-slate-200 font-bold mt-0.5">
                  {tx.amount !== undefined ? formatINR(tx.amount, tx.currency || '') : '—'}
                </p>
              </div>

              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Customer Reference</p>
                {tx.customerId ? (
                  <Link
                    to={`/customers/${tx.customerId}`}
                    className="font-mono text-cyan-400 hover:underline mt-0.5 block"
                  >
                    {tx.customerId}
                  </Link>
                ) : (
                  <span className="font-mono text-slate-400">—</span>
                )}
              </div>

              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Assigned Analyst</p>
                <p className="text-slate-200 mt-0.5 font-medium">{alert.assignedTo?.name || 'Unassigned Queue'}</p>
              </div>

              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Detection Timestamp</p>
                <p className="text-slate-300 mt-0.5 font-mono">
                  {alert.createdAt ? format(new Date(alert.createdAt), 'PPpp') : '—'}
                </p>
              </div>

              {alert.caseId && (
                <div>
                  <p className="text-slate-500 uppercase font-mono text-[10px]">Active Investigation Case</p>
                  <Link
                    to={`/cases/${alert.caseId._id}`}
                    className="font-mono text-purple-400 hover:underline flex items-center gap-1 mt-0.5 font-bold"
                  >
                    {alert.caseId.caseId || 'View Case'} <ExternalLink size={11} />
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Triggered Rules */}
          {alert.triggeredRules && alert.triggeredRules.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>TRIGGERED DETECTION RULES ({alert.triggeredRules.length})</CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">Specific rule violations and score contributions</p>
                </div>
              </CardHeader>
              <div className="space-y-2.5">
                {alert.triggeredRules.map((r, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="text-xs font-mono font-bold text-cyan-400">{r.rule}</span>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{r.description}</p>
                    </div>
                    <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      +{r.score}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Analyst Notes / Comments */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>INVESTIGATION NOTES & AUDIT TRAIL ({alert.comments?.length || 0})</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Documented reviewer notes and analytical decisions</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowComment(true)}>
                <MessageSquare size={13} /> Add Note
              </Button>
            </CardHeader>

            {!alert.comments?.length ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No analyst notes recorded yet. Add your evaluation findings.
              </p>
            ) : (
              <div className="space-y-3">
                {alert.comments.map((c, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 text-[10px] font-bold">
                          {c.author?.name?.[0] || 'U'}
                        </div>
                        <span className="text-xs font-semibold text-slate-200">{c.author?.name || 'Reviewer'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ALERT LIFECYCLE ACTIONS</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <Select
                label="Update Status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="open">Open (Awaiting Review)</option>
                <option value="in_review">In Review (Investigating)</option>
                <option value="escalated">Escalated (Senior Review)</option>
                <option value="resolved">Resolved (Remediated)</option>
                <option value="false_positive">False Positive (Benign Activity)</option>
              </Select>

              <Button
                loading={updating}
                onClick={updateStatus}
                className="w-full justify-center"
                size="sm"
              >
                Apply Lifecycle State
              </Button>

              <div className="pt-3 border-t border-slate-800">
                {!alert.caseId ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center text-xs"
                    onClick={() => {
                      setCaseForm({
                        title: `Case: ${alert.title}`,
                        description: `Initiated from ${alert.alertId}. Exposure: ${tx.amount !== undefined ? formatINR(tx.amount, tx.currency || '') : '—'}`,
                        priority: isCritical ? 'critical' : 'high',
                      });
                      setShowCaseModal(true);
                    }}
                  >
                    <FolderOpen size={13} /> Open Investigation Case
                  </Button>
                ) : (
                  <Link to={`/cases/${alert.caseId._id}`}>
                    <Button variant="outline" size="sm" className="w-full justify-center text-xs">
                      View Linked Investigation Case
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Add Comment Modal */}
      <Modal isOpen={showComment} onClose={() => setShowComment(false)} title="Record Investigation Note">
        <div className="space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Record analyst findings, evidence references, or verification steps..."
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowComment(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={addComment} disabled={!comment.trim()}>
              Save Note
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Case Modal */}
      <Modal isOpen={showCase} onClose={() => setShowCase(false)} title="Create Investigation Case">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Case Title *</label>
            <input
              value={caseForm.title}
              onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <Select
            label="Case Priority"
            value={caseForm.priority}
            onChange={(e) => setCaseForm({ ...caseForm, priority: e.target.value })}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          <Textarea
            label="Initial Findings"
            value={caseForm.description}
            onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })}
            rows={3}
            placeholder="Document preliminary assessment and customer context..."
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setShowCase(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={creatingCase} onClick={createCase} disabled={!caseForm.title.trim()}>
              Create Case
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
