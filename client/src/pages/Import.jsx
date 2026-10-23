import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Play,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function Import() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportError(null);
      setImportSummary(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setImportSummary(null);
    setImportError(null);

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
      const responseData = err.response?.data;
      setImportError({
        message: responseData?.message || 'CSV ingestion failed. Check the file format and try again.',
        missingColumns: responseData?.errors?.missingColumns || [],
        foundColumns: responseData?.errors?.foundColumns || [],
      });
      toast.error(responseData?.message || 'CSV ingestion failed');
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
      <PageHeader
        title="Data Import"
        description="Upload a CSV file to assess payment records, or run the webhook simulator with test data."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CSV Ingestion */}
        <Card>
          <CardHeader>
            <CardTitle>Import a CSV file</CardTitle>
          </CardHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-7 text-center hover:border-blue-500/80 transition-colors bg-white/40">
              <UploadCloud size={38} className="mx-auto text-blue-700 mb-2" />
              <p className="text-sm text-slate-800 font-semibold">Select or drag CSV batch file</p>
              <p className="text-xs text-slate-600 mt-1">
                Required columns: <code className="font-mono text-blue-700">transactionId, customerId, amount, currency, timestamp</code>
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-4 block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-50 cursor-pointer"
              />
              {file && (
                <p className="text-xs text-emerald-700 mt-2.5 font-mono font-semibold">
                  Selected File: {file.name}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">Accepted format: CSV. Channel and merchant details are optional. Download the template for an example.</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-xs text-blue-700 hover:text-blue-700 underline flex items-center gap-1 font-mono"
              >
                <FileSpreadsheet size={13} /> Download Template (.CSV)
              </button>
              <Button type="submit" size="sm" loading={uploading} disabled={!file} className="text-xs">
                Process & Score Batch
              </Button>
            </div>
          </form>

          {importError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-rose-700" />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {importError.missingColumns.length
                      ? 'This file is missing required columns'
                      : 'The file could not be imported'}
                  </p>
                  <p className="mt-1 break-words">{importError.message}</p>
                  {importError.missingColumns.length > 0 && (
                    <>
                      <p className="mt-2 font-medium">Add these columns to the CSV header:</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {importError.missingColumns.map((column) => (
                          <li
                            key={column}
                            className="rounded-md border border-rose-200 bg-white px-2 py-0.5 font-mono text-xs"
                          >
                            {column}
                          </li>
                        ))}
                      </ul>
                      {importError.foundColumns.length > 0 && (
                        <p className="mt-2 text-xs text-rose-800">
                          Columns detected: <span className="font-mono">{importError.foundColumns.join(', ')}</span>
                        </p>
                      )}
                      <p className="mt-2 text-xs text-rose-800">
                        Keep the required column names in the header row. Capitalization, spaces, and underscores are accepted.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {importSummary && (
            <div className="mt-5 p-4 bg-white border border-slate-200 rounded-2xl space-y-2.5">
              <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                Ingestion Results Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1 font-mono text-xs">
                <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200">
                  <p className="text-slate-500 text-[10px] uppercase">Total</p>
                  <p className="text-base font-bold text-slate-800">{importSummary.total || 0}</p>
                </div>
                <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200">
                  <p className="text-slate-500 text-[10px] uppercase">Accepted</p>
                  <p className="text-base font-bold text-emerald-700">{importSummary.accepted || 0}</p>
                </div>
                <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200">
                  <p className="text-slate-500 text-[10px] uppercase">Duplicates</p>
                  <p className="text-base font-bold text-amber-700">{importSummary.duplicates || 0}</p>
                </div>
                <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200">
                  <p className="text-slate-500 text-[10px] uppercase">Invalid</p>
                  <p className="text-base font-bold text-rose-700">{importSummary.invalid || 0}</p>
                </div>
                <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200">
                  <p className="text-slate-500 text-[10px] uppercase">Rejected</p>
                  <p className="text-base font-bold text-slate-600">{importSummary.rejected || 0}</p>
                </div>
              </div>
              {importSummary.errors?.length > 0 && (
                <ul className="space-y-1 border-t border-slate-200 pt-2 text-xs text-amber-700" aria-label="Import row errors">
                  {importSummary.errors.map((item, index) => (
                    <li key={`${item.row}-${item.transactionId || index}`}>
                      Row {item.row}{item.transactionId ? ` (${item.transactionId})` : ''}: {item.errors.join('; ')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* Webhook Pipeline Simulator */}
        <Card>
          <CardHeader>
            <CardTitle>PAYMENT STREAM SIMULATOR</CardTitle>
          </CardHeader>
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              Inject real-time synthetic payment events through the full risk engine pipeline. Inbound transactions will be evaluated against active heuristic rules, customer velocity baselines, and anomaly thresholds.
            </p>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <CheckCircle2 size={15} className="text-blue-700" />
                <span>Detection Engine Steps Executed:</span>
              </div>
              <ul className="text-slate-600 space-y-1 list-disc list-inside font-mono text-[11px]">
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
                <Play size={13} className="mr-1 text-blue-700" /> Simulate 5 Inbound Payment Webhooks
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
