import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Plus,
  ExternalLink,
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
import { useAuth } from '../contexts/AuthContext';

export default function CaseDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [caseDoc, setCaseDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [updateForm, setUpdateForm] = useState({ status: '', outcome: '', resolutionNote: '', assignedTo: '' });
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assigneesUnavailable, setAssigneesUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCase = useCallback(async () => {
    setLoadError('');
    try {
      const res = await api.get(`/cases/${id}`);
      const c = res.data.data;
      if (!c) throw new Error('Case record not found.');
      setCaseDoc(c);
      setUpdateForm({
        status: c.status,
        outcome: c.outcome || '',
        resolutionNote: c.resolutionNote || '',
        assignedTo: c.assignedTo?._id || '',
      });
    } catch (error) {
      setCaseDoc(null);
      setLoadError(
        error.response?.data?.message
          || error.message
          || 'Unable to load this case. Check your connection and try again.'
      );
      toast.error('Failed to load case investigation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchCase();
  }, [fetchCase]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await api.post(`/cases/${id}/notes`, { text: noteText });
      setNoteText('');
      setShowNote(false);
      toast.success('Investigation note saved.');
      fetchCase();
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCase = async () => {
    if (updateForm.outcome && !updateForm.resolutionNote.trim()) {
      toast.error('A detailed resolution note is required when recording an investigation outcome');
      return;
    }
    setSaving(true);
    try {
      const payload = { status: updateForm.status };
      if (updateForm.outcome) {
        payload.outcome = updateForm.outcome;
        payload.resolutionNote = updateForm.resolutionNote;
      }
      if (isAdmin) payload.assignedTo = updateForm.assignedTo || null;
      await api.patch(`/cases/${id}`, payload);
      setShowUpdate(false);
      toast.success('Investigation case updated successfully.');
      fetchCase();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const openUpdateModal = async () => {
    if (isAdmin) {
      setAssigneesUnavailable(false);
      try {
        const response = await api.get('/users', { params: { limit: 100, isActive: true } });
        if (!Array.isArray(response.data?.data)) {
          throw new Error('The user service returned an unexpected response.');
        }
        setAssignableUsers(response.data.data);
      } catch (error) {
        setAssigneesUnavailable(true);
        toast.error(error.response?.data?.message || error.message || 'Could not load active investigators.');
      }
    }
    setShowUpdate(true);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (!caseDoc) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center">
        <p role="alert" className="text-sm text-slate-700">{loadError || 'Case record not found.'}</p>
        <div className="mt-4 flex justify-center gap-3">
          {loadError && (
            <Button size="sm" onClick={() => { setLoading(true); fetchCase(); }}>Retry</Button>
          )}
          <Link to="/cases">
            <Button variant="secondary" size="sm">Back to Cases</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <Link
            to="/cases"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{caseDoc.title}</h1>
              <RiskBadge level={caseDoc.priority} size="sm" />
              <StatusBadge status={caseDoc.status} size="sm" />
              {caseDoc.outcome && <StatusBadge status={caseDoc.outcome} size="sm" />}
            </div>
            <p className="text-xs text-slate-600 font-mono mt-0.5">Case Reference: {caseDoc.caseId}</p>
          </div>
        </div>

        <Button size="sm" onClick={openUpdateModal} className="text-xs">
          Update Status / Outcome
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Summary, Notes, Timeline, Transactions */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>INVESTIGATION SUMMARY</CardTitle>
            </CardHeader>
            <p className="text-sm text-slate-700 leading-relaxed mb-5">
              {caseDoc.description || 'No initial summary recorded.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-xs">
              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Created By</p>
                <p className="text-slate-800 mt-0.5 font-medium">{caseDoc.createdBy?.name || 'Security Lead'}</p>
              </div>

              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Assigned Investigator</p>
                <p className="text-slate-800 mt-0.5 font-medium">{caseDoc.assignedTo?.name || 'Unassigned Queue'}</p>
              </div>

              <div>
                <p className="text-slate-500 uppercase font-mono text-[10px]">Opened Date</p>
                <p className="text-slate-700 mt-0.5 font-mono">
                  {caseDoc.createdAt ? format(new Date(caseDoc.createdAt), 'PPpp') : '—'}
                </p>
              </div>

              {caseDoc.resolvedAt && (
                <div>
                  <p className="text-slate-500 uppercase font-mono text-[10px]">Resolved Date</p>
                  <p className="text-slate-700 mt-0.5 font-mono">{format(new Date(caseDoc.resolvedAt), 'PP')}</p>
                </div>
              )}

              {caseDoc.outcome && (
                <div className="col-span-2">
                  <p className="text-slate-500 uppercase font-mono text-[10px]">Official Case Outcome</p>
                  <div className="mt-1">
                    <StatusBadge status={caseDoc.outcome} size="md" />
                  </div>
                </div>
              )}
            </div>

            {caseDoc.resolutionNote && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs font-mono uppercase text-slate-600 font-semibold mb-1">
                  Documented Resolution Findings
                </p>
                <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-800 leading-relaxed">
                  {caseDoc.resolutionNote}
                </div>
              </div>
            )}
          </Card>

          {/* Investigation Notes */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>INVESTIGATION EVIDENCE & NOTES ({caseDoc.notes?.length || 0})</CardTitle>
                <p className="text-xs text-slate-600 mt-0.5">Chronological record of investigator findings</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowNote(true)}>
                <Plus size={13} /> Add Finding
              </Button>
            </CardHeader>

            {!caseDoc.notes?.length ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No investigation findings logged yet. Use the button above to add evidence.
              </p>
            ) : (
              <div className="space-y-3">
                {caseDoc.notes.map((n, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/80 border border-slate-200">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 text-[10px] font-bold">
                          {n.author?.name?.[0] || 'U'}
                        </div>
                        <span className="text-xs font-semibold text-slate-800">{n.author?.name || 'Analyst'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Linked Transactions */}
          {caseDoc.transactions && caseDoc.transactions.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>LINKED TRANSACTIONS ({caseDoc.transactions.length})</CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">Payments subject to this investigation</p>
                </div>
              </CardHeader>
              <div className="space-y-2">
                {caseDoc.transactions.map((tx) => (
                  <Link
                    key={tx._id}
                    to={`/transactions/${tx._id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white/80 border border-slate-200 hover:border-slate-200 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-mono font-bold text-blue-700">{tx.transactionId}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {tx.customerId} · <strong className="text-slate-800">{formatINR(tx.amount, tx.currency || '')}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={tx.riskLevel} score={tx.riskScore} size="sm" />
                      <ExternalLink size={13} className="text-slate-500" />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Audit Timeline */}
          {caseDoc.timeline && caseDoc.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>CASE AUDIT TIMELINE</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {[...caseDoc.timeline].reverse().map((t, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <Clock size={13} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-800 font-medium">{t.event}</p>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {t.actor?.name || 'System'} ·{' '}
                        {t.timestamp ? formatDistanceToNow(new Date(t.timestamp), { addSuffix: true }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Linked Alerts & Quick Tools */}
        <div className="space-y-4">
          {caseDoc.alerts && caseDoc.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>LINKED THREAT ALERTS ({caseDoc.alerts.length})</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {caseDoc.alerts.map((a) => (
                  <Link
                    key={a._id}
                    to={`/alerts/${a._id}`}
                    className="p-3 rounded-xl bg-white/80 border border-slate-200 hover:border-slate-200 transition-colors block"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-slate-800 truncate">{a.alertId}</span>
                      <RiskBadge level={a.severity} size="sm" />
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{a.title}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Note modal */}
      <Modal isOpen={showNote} onClose={() => setShowNote(false)} title="Record Investigation Finding">
        <div className="space-y-3">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={5}
            placeholder="Record evidence analysis, customer communication, IP geolocation, or next steps..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowNote(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={addNote} disabled={!noteText.trim()}>
              Save Finding
            </Button>
          </div>
        </div>
      </Modal>

      {/* Update Modal */}
      <Modal isOpen={showUpdate} onClose={() => setShowUpdate(false)} title="Update Case Lifecycle & Outcome">
        <div className="space-y-4">
          <Select
            label="Lifecycle State"
            value={updateForm.status}
            onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress (Investigating)</option>
            <option value="escalated">Escalated (Senior Review)</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </Select>

          {isAdmin && (
            <div>
              <Select
                label="Assigned investigator"
                value={updateForm.assignedTo}
                onChange={(e) => setUpdateForm({ ...updateForm, assignedTo: e.target.value })}
                disabled={assigneesUnavailable}
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((investigator) => (
                  <option key={investigator._id} value={investigator._id}>
                    {investigator.name} ({investigator.role})
                  </option>
                ))}
              </Select>
              {assigneesUnavailable && (
                <p role="status" className="mt-1 text-xs text-amber-700">
                  Investigator options are unavailable. Status updates can still be saved.
                </p>
              )}
            </div>
          )}

          <Select
            label="Investigation Outcome (Required for resolution)"
            value={updateForm.outcome}
            onChange={(e) => setUpdateForm({ ...updateForm, outcome: e.target.value })}
          >
            <option value="">— No outcome decided yet —</option>
            <option value="confirmed_fraud">Confirmed Fraud (Account compromise / unauthorized)</option>
            <option value="legitimate">Legitimate Activity (False alarm / verified customer)</option>
            <option value="inconclusive">Inconclusive (Insufficient evidence)</option>
          </Select>

          {updateForm.outcome && (
            <Textarea
              label="Mandatory Resolution Note *"
              value={updateForm.resolutionNote}
              onChange={(e) => setUpdateForm({ ...updateForm, resolutionNote: e.target.value })}
              rows={4}
              placeholder="Provide clear forensic justification for this outcome..."
            />
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" onClick={() => setShowUpdate(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={handleUpdateCase}>
              Save Outcome
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
