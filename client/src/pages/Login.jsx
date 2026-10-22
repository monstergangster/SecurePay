import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Activity,
  Cpu,
  AlertTriangle,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Email and password credentials are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      toast.success(`Authenticated: Welcome, ${user.name}`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillCredentials = (email, password) => {
    setForm({ email, password });
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex text-[#111827]">
      {/* Left Column: Visual Storytelling */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 bg-white border-r border-slate-200">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono text-slate-900 tracking-wider">SECUREPAY</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  SOC v1.0
                </span>
              </div>
              <p className="text-xs font-mono text-slate-600">FRAUD INTELLIGENCE COMMAND CENTER</p>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-slate-900 leading-tight mb-4 tracking-tight">
            Enterprise Digital Payment Fraud Detection & Surveillance
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-lg mb-10">
            Real-time transaction surveillance, heuristic rule weights, statistical anomaly isolation, and forensic investigation workflows designed for banking and payment operations teams.
          </p>

          {/* Real-Time Detection Lifecycle Diagram (Section 30) */}
          <div className="space-y-3 p-5 rounded-2xl bg-white/60 border border-slate-200/80 backdrop-blur">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold mb-3">
              Automated Detection & Investigation Lifecycle
            </p>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 flex flex-col items-center">
                <Activity size={16} className="text-blue-700 mb-1" />
                <span className="text-[11px] font-mono font-bold text-slate-800">Payment</span>
                <span className="text-[9px] text-slate-500">Inbound Tx</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 flex flex-col items-center">
                <Cpu size={16} className="text-blue-700 mb-1" />
                <span className="text-[11px] font-mono font-bold text-slate-800">Risk Engine</span>
                <span className="text-[9px] text-slate-500">Heuristics</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 flex flex-col items-center">
                <AlertTriangle size={16} className="text-amber-700 mb-1" />
                <span className="text-[11px] font-mono font-bold text-slate-800">Anomaly</span>
                <span className="text-[9px] text-slate-500">Isolation</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 flex flex-col items-center">
                <ShieldAlert size={16} className="text-red-700 mb-1" />
                <span className="text-[11px] font-mono font-bold text-slate-800">Alert</span>
                <span className="text-[9px] text-slate-500">Dedup Vector</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 flex flex-col items-center">
                <FolderOpen size={16} className="text-purple-700 mb-1" />
                <span className="text-[11px] font-mono font-bold text-slate-800">Case</span>
                <span className="text-[9px] text-slate-500">Outcome Filing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Quick Access Credentials */}
        <div className="space-y-2 pt-6 border-t border-slate-200/80">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold">
            Pre-Configured Demo Credentials (Click to Autofill)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleFillCredentials('admin@securepay.dev', 'Admin@SecurePay2024')}
              className="px-3 py-2 text-xs font-mono rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-50 text-purple-700 transition-colors text-left flex-1"
            >
              <strong className="block text-slate-900">Administrator</strong>
              admin@securepay.dev
            </button>
            <button
              type="button"
              onClick={() => handleFillCredentials('analyst@securepay.dev', 'Analyst@SecurePay2024')}
              className="px-3 py-2 text-xs font-mono rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-50 text-blue-700 transition-colors text-left flex-1"
            >
              <strong className="block text-slate-900">Fraud Analyst</strong>
              analyst@securepay.dev
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md p-8 rounded-2xl bg-white/80 border border-slate-200 backdrop-blur shadow-2xl">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <Shield size={22} className="text-blue-700" />
            <span className="text-base font-bold font-mono text-slate-900">SECUREPAY SOC</span>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-1 tracking-tight">Security Portal Sign In</h2>
          <p className="text-xs text-slate-600 mb-6">
            Authorized personnel only. All access and review actions are immutably logged in the security audit trail.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Personnel Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="analyst@securepay.dev"
                autoComplete="email"
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-11 text-xs font-mono text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors text-xs font-mono shadow-sm disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Lock size={14} />
              )}
              {loading ? 'Authenticating...' : 'Authorize & Enter Command Center'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
