import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  RefreshCw,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { InsightCard } from '../components/ui/InsightCard';
import { Skeleton } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import toast from 'react-hot-toast';
import { formatINR } from '../utils/currency';

const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 text-xs shadow-xl font-mono">
        <p className="text-slate-400 mb-1 font-semibold">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
            <span style={{ color: p.color }} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}:
            </span>
            <span className="text-white font-bold">{p.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState(null);
  const [caseStats, setCaseStats] = useState(null);
  const [dashSummary, setDashSummary] = useState(null);
  const [loadErrors, setLoadErrors] = useState([]);
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get('/analytics/risk', { params: { days } }),
      api.get('/analytics/cases'),
      api.get('/analytics/dashboard'),
    ]);
    const [riskResult, casesResult, dashboardResult] = results;
    const errors = [];

    if (riskResult.status === 'fulfilled') {
      setRiskData(riskResult.value.data?.data || null);
    } else {
      setRiskData(null);
      errors.push(`Risk trends: ${riskResult.reason?.response?.data?.message || 'unavailable'}`);
    }
    if (casesResult.status === 'fulfilled') {
      setCaseStats(casesResult.value.data?.data || null);
    } else {
      setCaseStats(null);
      errors.push(`Case outcomes: ${casesResult.reason?.response?.data?.message || 'unavailable'}`);
    }
    if (dashboardResult.status === 'fulfilled') {
      setDashSummary(dashboardResult.value.data?.data?.summary || null);
    } else {
      setDashSummary(null);
      errors.push(`Dashboard summary: ${dashboardResult.reason?.response?.data?.message || 'unavailable'}`);
    }
    setLoadErrors(errors);
    if (errors.length) toast.error('Some analytics could not be loaded');
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/transactions/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `securepay_transactions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Transaction intelligence report exported');
    } catch {
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  };

  // Derive real insights from actual returned data
  const channelRisk = riskData?.channelRisk || [];
  const topRules = riskData?.topRulesTriggered || [];

  // 1. Highest Risk Channel
  let highestRiskChannel = 'None';
  let highestChannelAnom = 0;
  if (channelRisk.length > 0) {
    const sorted = [...channelRisk].sort((a, b) => (b.flagged || 0) - (a.flagged || 0));
    if (sorted[0] && sorted[0]._id) {
      highestRiskChannel = sorted[0]._id.replace(/_/g, ' ').toUpperCase();
      highestChannelAnom = sorted[0].flagged || 0;
    }
  }

  // 2. Most Common Anomaly Rule
  let topAnomalyRule = 'Nominal';
  let topRuleTriggers = 0;
  if (topRules.length > 0) {
    topAnomalyRule = topRules[0].name || topRules[0].ruleId;
    topRuleTriggers = topRules[0].triggerCount || 0;
  }

  // 3. Money at Risk
  const moneyAtRisk = dashSummary?.moneyAtRisk ?? null;
  const moneyProtected = dashSummary?.moneyProtected ?? null;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <PageHeader
        title="Behaviour Analytics"
        description="Explore real payment and investigation patterns for the selected period."
        actions={(
          <>
          <Select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-32 text-xs"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            loading={exporting}
            className="text-xs"
          >
            <Download size={13} /> Export report
          </Button>

          <button
            onClick={fetchAnalytics}
            type="button"
            aria-label="Refresh analytics"
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
          </>
        )}
      />

      {loadErrors.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <p>Some analytics are unavailable. Refresh to try again.</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-rose-300">
            {loadErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

      {/* 2. Insight Cards Strip (Section 26) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <InsightCard
              title="Highest Risk Channel"
              highlight={riskData ? (highestRiskChannel === 'None' ? 'No channel data' : highestRiskChannel) : 'Unavailable'}
              subtitle={`${highestChannelAnom} flagged transactions observed`}
              icon={CreditCard}
              variant="amber"
            />
            <InsightCard
              title="Primary Anomaly Vector"
              highlight={riskData ? (topRules.length ? topAnomalyRule : 'No rules triggered') : 'Unavailable'}
              subtitle={`${topRuleTriggers} rule activations recorded`}
              icon={ShieldAlert}
              variant="rose"
            />
            <InsightCard
              title="Total Exposure at Risk"
              highlight={formatINR(moneyAtRisk)}
              subtitle="Cumulative value in flagged/high-risk state"
              icon={Zap}
              variant="cyan"
            />
            <InsightCard
              title="Intercepted Loss"
              highlight={formatINR(moneyProtected)}
              subtitle="Fraudulent capital blocked by security rules"
              icon={ShieldCheck}
              variant="purple"
            />
          </>
        )}
      </div>

      {/* 3. Trend & Channel Risk Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>DAILY AVERAGE RISK SCORE EVOLUTION</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Empirical average risk score computed across all transactions</p>
            </div>
          </CardHeader>
          {loading ? (
            <Skeleton className="h-56" />
          ) : !riskData?.riskTrend?.length ? (
            <p className="text-xs text-slate-500 py-16 text-center">No trend data available for this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={riskData.riskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="_id" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickFormatter={(v) => v?.slice(5)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} domain={[0, 100]} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="avgRisk"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  name="Avg Risk Score"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>TRANSACTION VOLUME & ANOMALIES BY CHANNEL</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Comparison between total traffic and flagged suspicious events</p>
            </div>
          </CardHeader>
          {loading ? (
            <Skeleton className="h-56" />
          ) : !channelRisk.length ? (
            <p className="text-xs text-slate-500 py-16 text-center">No channel statistics available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={channelRisk}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="_id" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickFormatter={(v) => v?.replace(/_/g, ' ')} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#06b6d4" name="Total Volume" radius={[4, 4, 0, 0]} />
                <Bar dataKey="flagged" fill="#ef4444" name="Flagged Anomalies" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* 4. Top Triggered Rules & Case Outcomes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card padding={false}>
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide font-mono">
              Top Triggered Detection Rules
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Heuristics contributing most heavily to platform risk scores</p>
          </div>
          <div className="p-4 space-y-2.5">
            {loading ? (
              <Skeleton className="h-44" />
            ) : !topRules.length ? (
              <p className="text-xs text-slate-500 text-center py-8">No rule activations recorded.</p>
            ) : (
              topRules.map((rule) => (
                <div
                  key={rule.ruleId}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{rule.name}</p>
                    <p className="text-[11px] font-mono text-cyan-400 mt-0.5">{rule.ruleId} · {rule.category}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950 px-2.5 py-1 rounded border border-amber-800">
                    {rule.triggerCount} triggers
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card padding={false}>
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide font-mono">
              Investigation Case Outcomes
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Ground-truth resolution filing distribution</p>
          </div>
          <div className="p-4 space-y-2.5">
            {loading ? (
              <Skeleton className="h-44" />
            ) : !caseStats?.casesByOutcome?.length ? (
              <p className="text-xs text-slate-500 text-center py-8">No investigation cases resolved yet.</p>
            ) : (
              caseStats.casesByOutcome.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80"
                >
                  <span className="text-xs font-medium text-slate-300 capitalize">
                    {item._id?.replace(/_/g, ' ') || 'Unspecified'}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
                    {item.count} cases
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
