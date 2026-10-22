import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Ban,
  FolderOpen,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { RiskScore } from '../components/ui/RiskScore';
import { RiskMeter } from '../components/ui/RiskMeter';
import { BehavioralComparison } from '../components/ui/BehavioralComparison';
import { DetectionTimeline } from '../components/ui/DetectionTimeline';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Textarea, Select } from '../components/ui/Input';
import { Skeleton } from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatINR } from '../utils/currency';

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseForm, setCaseForm] = useState({ title: '', description: '', priority: 'high' });
  const [creatingCase, setCreatingCase] = useState(false);

  const fetchTransaction = useCallback(async () => {
    setLoadError('');
    try {
      const res = await api.get(`/transactions/${id}`);
      if (!res.data?.data?.transaction) throw new Error('Transaction record not found.');
      setData(res.data.data);
    } catch (error) {
      setData(null);
      setLoadError(
        error.response?.data?.message
          || error.message
          || 'Unable to load this transaction. Check your connection and try again.'
      );
      toast.error('Failed to load transaction intelligence');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchTransaction();
  }, [fetchTransaction]);

  const handleUpdateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await api.patch(`/transactions/${id}/status`, {
        status: newStatus,
        reviewStatus: 'reviewed',
        notes: `Analyst updated status to ${newStatus} directly from transaction risk review.`,
      });
      toast.success(
        newStatus === 'blocked'
          ? 'Transaction blocked successfully.'
          : newStatus === 'approved'
          ? 'Transaction approved & cleared.'
          : 'Transaction status updated.'
      );
      fetchTransaction();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update transaction status');
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateCase = async () => {
    if (!caseForm.title.trim()) return;
    setCreatingCase(true);
    try {
      const res = await api.post('/cases', {
        title: caseForm.title,
        description: caseForm.description,
        transactionIds: [id],
        priority: caseForm.priority,
      });
      toast.success('Investigation case created successfully.');
      setShowCaseModal(false);
      navigate(`/cases/${res.data.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create case');
    } finally {
      setCreatingCase(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data || !data.transaction) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center">
        <p role="alert" className="text-sm text-slate-700">{loadError || 'Transaction record not found.'}</p>
        <div className="mt-4 flex justify-center gap-3">
          {loadError && (
            <Button size="sm" onClick={() => { setLoading(true); fetchTransaction(); }}>
              Retry
            </Button>
          )}
          <Link to="/transactions">
            <Button variant="secondary" size="sm">Back to Transactions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { transaction: tx, alerts = [], assessments = [], behavioralProfile } = data;
  const hasRiskAssessment = Number.isFinite(tx.riskScore);
  const isHighRisk = hasRiskAssessment && tx.riskScore >= 55;
  const isCritical = hasRiskAssessment && tx.riskScore >= 80;

  // Generate explainable risk recommendation based on actual data
  let recommendation = hasRiskAssessment
    ? 'The available signals are within the low-risk range. This score is a risk indicator, not a probability of fraud.'
    : 'A risk assessment is not available for this transaction.';
  let recommendedAction = hasRiskAssessment ? 'Proceed after standard checks' : 'Review assessment results';
  if (isCritical) {
    recommendation =
      'Multiple critical risk thresholds were exceeded. Review the listed rule results and behavioral signals; the score is not a probability of fraud.';
    recommendedAction = 'Review immediately; block if evidence confirms fraud';
  } else if (isHighRisk) {
    recommendation =
      'The elevated score reflects triggered rules or unusual behavioral signals. Verify the evidence before deciding whether to approve or block this payment.';
    recommendedAction = 'Verify the signals and consider opening an investigation';
  } else if (hasRiskAssessment && tx.riskScore >= 25) {
    recommendation =
      'Some monitoring thresholds were crossed. Review the contributing signals; the score does not represent the probability that this transaction is fraudulent.';
    recommendedAction = 'Review the signals and monitor customer activity';
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Navigation & Top Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <Link
            to="/transactions"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{tx.transactionId}</h1>
              <StatusBadge status={tx.status} />
              {tx.isDemo && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Evaluated on {tx.timestamp ? format(new Date(tx.timestamp), 'PPpp') : '—'}
            </p>
          </div>
        </div>

        {/* Quick Action Remediations */}
        <div className="flex items-center gap-2">
          {tx.status !== 'blocked' && (
            <button
              onClick={() => handleUpdateStatus('blocked')}
              disabled={updating}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Ban size={13} /> Block Transaction
            </button>
          )}

          {tx.status !== 'approved' && (
            <button
              onClick={() => handleUpdateStatus('approved')}
              disabled={updating}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck size={13} /> Approve
            </button>
          )}

          <button
            onClick={() => {
              setCaseForm({
                title: `Investigation: ${tx.transactionId} (${formatINR(tx.amount, tx.currency || '')})`,
                description: `Initiated for customer ${tx.customerId}. Triggered ${tx.riskReasons?.length || 0} risk rules. Risk score: ${tx.riskScore}/100.`,
                priority: isCritical ? 'critical' : isHighRisk ? 'high' : 'medium',
              });
              setShowCaseModal(true);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-50 transition-colors flex items-center gap-1.5"
          >
            <FolderOpen size={13} /> Open Investigation Case
          </button>
        </div>
      </div>

      {/* 2. Prominent Risk Header & Score Banner (Section 16 & 17) */}
      <div
        className={`p-6 rounded-2xl border backdrop-blur transition-all ${
          isCritical
            ? 'bg-red-50 border-red-200'
            : isHighRisk
            ? 'bg-orange-50 border-orange-200'
            : 'bg-white/80 border-slate-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-600 font-semibold">
                Risk Engine Evaluation
              </span>
              <RiskBadge level={tx.riskLevel} score={tx.riskScore} size="lg" />
              <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                Source: {tx.assessmentSource?.toUpperCase() || 'RULES_ENGINE'}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl lg:text-4xl font-extrabold text-slate-900 font-mono">
                {formatINR(tx.amount, tx.currency || '')}
              </span>
              <span className="text-sm font-mono text-slate-600 uppercase">
                via {tx.channel?.replace(/_/g, ' ') || 'card'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed max-w-2xl">
              {recommendation}
            </p>
          </div>

          {/* Visual Risk Gauge */}
          <div className="flex items-center gap-6 lg:border-l border-slate-200 lg:pl-8">
            <RiskScore score={tx.riskScore} size="xl" subtitle="Calculated Risk" />
          </div>
        </div>

        {/* Risk meter horizontal indicator */}
        <div className="mt-5 pt-4 border-t border-slate-200/80">
          <RiskMeter score={tx.riskScore} />
        </div>
      </div>

      {/* 3. Explainable Fraud Detection Factors (Section 16 & 20) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Why Was This Transaction Flagged? */}
        <Card className="lg:col-span-2 space-y-4">
          <CardHeader>
            <div>
              <CardTitle>WHY WAS THIS TRANSACTION FLAGGED?</CardTitle>
              <p className="text-xs text-slate-600 mt-0.5">
                Explainable heuristic rules and statistical signals contributing to risk score
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
              {tx.riskReasons?.length || 0} Triggered Factors
            </span>
          </CardHeader>

          {tx.riskReasons && tx.riskReasons.length > 0 ? (
            <div className="space-y-3">
              {tx.riskReasons.map((r, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white/70 border border-slate-200/90 hover:border-slate-200 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono font-bold text-blue-700 tracking-wide">
                      {r.rule}
                    </span>
                    <span className="text-xs font-mono font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      +{r.score} PTS
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-white/40 rounded-xl border border-slate-200/80">
              <CheckCircle2 size={32} className="mx-auto text-emerald-700 mb-2" />
              <p className="text-sm font-semibold text-slate-800">No Risk Rules Triggered</p>
              <p className="text-xs text-slate-600 mt-1">
                Transaction strictly complied with all active heuristic limits, amount thresholds, and velocity windows.
              </p>
            </div>
          )}

          {/* ML Anomaly Model Insights (if ML Service was used) */}
          {tx.mlScore !== null && tx.mlScore !== undefined && (
            <div className="mt-4 p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-purple-700" />
                  <span className="text-xs font-mono font-bold text-slate-800">
                    ML ISOLATION FOREST ANOMALY INFERENCE
                  </span>
                </div>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                    tx.mlDecision === 'anomalous'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {tx.mlDecision?.toUpperCase()}
                </span>
              </div>

              <div className="flex justify-between items-baseline text-xs text-slate-600">
                <span>Model Anomaly Score:</span>
                <span className="text-sm font-mono font-extrabold text-purple-700">
                  {tx.mlScore} / 100
                </span>
              </div>

              {tx.mlExplanation && tx.mlExplanation.length > 0 && (
                <div className="pt-2 border-t border-purple-200 space-y-1">
                  <p className="text-[11px] font-mono text-slate-600">Model Feature Contributions:</p>
                  <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                    {tx.mlExplanation.map((exp, idx) => (
                      <li key={idx}>{exp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Right: Risk Explanation & Analyst Recommendation */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>INVESTIGATOR ACTION ADVISORY</CardTitle>
            </CardHeader>
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold block">
                  Suggested analyst next step
                </span>
                <p className="text-sm font-bold text-blue-700 font-mono">{recommendedAction}</p>
                <p className="text-slate-600 leading-relaxed mt-1">
                  The 0–100 score ranks transaction risk; it is not a probability of fraud.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                  Transaction Metadata
                </p>
                <div className="divide-y divide-slate-200 text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Customer ID</span>
                    <Link
                      to={`/customers/${tx.customerId}`}
                      className="font-mono text-blue-700 hover:underline"
                    >
                      {tx.customerId}
                    </Link>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Merchant Category</span>
                    <span className="font-mono text-slate-700 capitalize">{tx.merchantCategory || 'Standard'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Merchant ID</span>
                    <span className="font-mono text-slate-700">{tx.merchantId || 'MERCH-UNSPECIFIED'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Ingestion Pipeline</span>
                    <span className="font-mono text-slate-700 capitalize">{tx.ingestionSource?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Review State</span>
                    <span className="font-mono text-slate-700 capitalize">{tx.reviewStatus?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. Customer Behaviour Analysis (Section 18) */}
      <Card>
        <BehavioralComparison
          transaction={tx}
          behavioralProfile={behavioralProfile}
        />
      </Card>

      {/* 5. Detection Lifecycle Timeline (Section 19) */}
      <Card>
        <DetectionTimeline
          transaction={tx}
          alerts={alerts}
          assessments={assessments}
        />
      </Card>

      {/* 6. Linked Alerts */}
      {alerts && alerts.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>ASSOCIATED THREAT ALERTS ({alerts.length})</CardTitle>
              <p className="text-xs text-slate-600 mt-0.5">Deduplicated alerts triggered by this transaction</p>
            </div>
          </CardHeader>
          <div className="space-y-2">
            {alerts.map((a) => (
              <Link
                key={a._id}
                to={`/alerts/${a._id}`}
                className="flex items-center justify-between p-3.5 bg-white/80 border border-slate-200 rounded-xl hover:border-slate-200 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                  <p className="text-xs font-mono text-slate-500">{a.alertId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={a.severity} size="sm" />
                  <StatusBadge status={a.status} size="sm" />
                  <ExternalLink size={13} className="text-slate-500 ml-2" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Create Case Modal */}
      <Modal isOpen={showCaseModal} onClose={() => setShowCaseModal(false)} title="Open Investigation Case">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Case Title *</label>
            <input
              value={caseForm.title}
              onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Select
            label="Investigation Priority"
            value={caseForm.priority}
            onChange={(e) => setCaseForm({ ...caseForm, priority: e.target.value })}
          >
            <option value="critical">Critical Priority</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </Select>

          <Textarea
            label="Initial Findings & Context"
            value={caseForm.description}
            onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })}
            rows={4}
            placeholder="Record initial fraud hypotheses, unusual velocity patterns, or customer contact notes..."
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" onClick={() => setShowCaseModal(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={creatingCase} onClick={handleCreateCase} disabled={!caseForm.title.trim()}>
              Open Case
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
