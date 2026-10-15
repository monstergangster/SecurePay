import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Database,
  Cpu,
} from 'lucide-react';
import api from '../services/api';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function Import() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setImportSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/imports/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportSummary(res.data.data?.summary || null);
      toast.success('Batch transaction file ingested and assessed.');
      setFile(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'CSV ingestion failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await api.post('/webhooks/simulate', { count: 5 });
      toast.success(`${res.data.data?.length || 5} simulated transactions ingested and risk-scored.`);
    } catch {
      toast.error('Simulation pipeline trigger failed');
    } finally {
      setSimulating(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'transactionId,customerId,amount,currency,channel,timestamp,merchantId,merchantCategory\n' +
      'TXN-BATCH-001,CUST-001,500.00,INR,card,2026-10-14T02:00:00Z,MERCH-01,retail\n' +
      'TXN-BATCH-002,CUST-002,25000.00,INR,crypto,2026-10-14T03:30:00Z,MERCH-02,finance\n' +
      'TXN-BATCH-003,CUST-003,100000.00,INR,bank_transfer,2026-10-14T04:15:00Z,MERCH-03,travel\n';
    // Sample amounts are raw numeric rupees; currency is explicit in each CSV row.

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'securepay_sample_import.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Sample CSV template downloaded');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Data Ingestion & Simulation</h1>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
            PIPELINE
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Batch ingest historical records via validated CSV or test the real-time detection pipeline with simulated webhook streams.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CSV Ingestion */}
        <Card>
          <CardHeader>
            <CardTitle>BATCH CSV INGESTION ENGINE</CardTitle>
          </CardHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-7 text-center hover:border-cyan-500/80 transition-colors bg-slate-950/40">
              <UploadCloud size={38} className="mx-auto text-cyan-400 mb-2" />
              <p className="text-sm text-slate-200 font-semibold">Select or drag CSV batch file</p>
              <p className="text-xs text-slate-400 mt-1">
                Schema: <code className="font-mono text-cyan-300">transactionId, customerId, amount, currency, timestamp</code>
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-4 block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
              />
              {file && (
                <p className="text-xs text-emerald-400 mt-2.5 font-mono font-semibold">
                  Selected File: {file.name}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 font-mono"
              >
                <FileSpreadsheet size={13} /> Download Template (.CSV)
              </button>
              <Button type="submit" size="sm" loading={uploading} disabled={!file} className="text-xs">
                Process & Score Batch
              </Button>
            </div>
          </form>

          {importSummary && (
            <div className="mt-5 p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
              <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                Ingestion Results Summary
              </h4>
              <div className="grid grid-cols-4 gap-2 text-center pt-1 font-mono text-xs">
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                  <p className="text-slate-500 text-[10px] uppercase">Accepted</p>
                  <p className="text-base font-bold text-emerald-400">{importSummary.accepted || 0}</p>
                </div>
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                  <p className="text-slate-500 text-[10px] uppercase">Duplicates</p>
                  <p className="text-base font-bold text-amber-400">{importSummary.duplicates || 0}</p>
                </div>
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                  <p className="text-slate-500 text-[10px] uppercase">Invalid</p>
                  <p className="text-base font-bold text-rose-400">{importSummary.invalid || 0}</p>
                </div>
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                  <p className="text-slate-500 text-[10px] uppercase">Rejected</p>
                  <p className="text-base font-bold text-slate-400">{importSummary.rejected || 0}</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Webhook Pipeline Simulator */}
        <Card>
          <CardHeader>
            <CardTitle>PAYMENT STREAM SIMULATOR</CardTitle>
          </CardHeader>
          <div className="space-y-4 text-xs">
            <p className="text-slate-400 leading-relaxed">
              Inject real-time synthetic payment events through the full risk engine pipeline. Inbound transactions will be evaluated against active heuristic rules, customer velocity baselines, and anomaly thresholds.
            </p>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <CheckCircle2 size={15} className="text-cyan-400" />
                <span>Detection Engine Steps Executed:</span>
              </div>
              <ul className="text-slate-400 space-y-1 list-disc list-inside font-mono text-[11px]">
                <li>Deterministic rule evaluation (High amount, night hours, unusual channels)</li>
                <li>Deduplicated alert generation on score threshold breach</li>
                <li>Customer historical baseline updating & Z-score calculation</li>
                <li>Immutable security audit logging with caller IP & payload</li>
              </ul>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSimulate}
                size="sm"
                variant="secondary"
                loading={simulating}
                className="w-full justify-center text-xs"
              >
                <Play size={13} className="mr-1 text-cyan-400" /> Simulate 5 Inbound Payment Webhooks
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
