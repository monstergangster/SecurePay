import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from 'react-hot-toast';
import { Menu, PanelLeftClose, PanelLeftOpen, Shield } from 'lucide-react';
import api from '../../services/api';

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthUnavailable, setHealthUnavailable] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const response = await api.get('/health');
        if (active) {
          setHealth(response.data?.data || null);
          setHealthUnavailable(!response.data?.data);
        }
      } catch (error) {
        if (active) {
          setHealth(error.response?.data?.data || null);
          setHealthUnavailable(!error.response?.data?.data);
        }
      }
    };
    checkHealth();
    const timer = window.setInterval(checkHealth, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const serviceState = (service) => {
    if (healthUnavailable) return 'Unavailable';
    if (!health) return 'Unknown';
    const value = health.services?.[service];
    if (value === 'connected' || value === 'operational') return 'Healthy';
    if (value === 'degraded') return 'Degraded';
    if (value === 'unavailable' || value === 'disconnected') return 'Unavailable';
    return 'Unknown';
  };

  const serviceColor = (state) => ({
    Healthy: 'text-emerald-400',
    Degraded: 'text-amber-400',
    Unavailable: 'text-rose-400',
    Unknown: 'text-slate-400',
  }[state]);

  const pageName = location.pathname === '/'
    ? 'Command Center'
    : location.pathname.startsWith('/alerts')
    ? 'Threat Center'
    : location.pathname.startsWith('/transactions')
    ? 'Transactions'
    : location.pathname.startsWith('/cases')
    ? 'Cases'
    : location.pathname.startsWith('/customers')
    ? 'Customers'
    : location.pathname.startsWith('/analytics')
    ? 'Behaviour Analytics'
    : location.pathname.startsWith('/rules')
    ? 'Rules'
    : location.pathname.startsWith('/audit')
    ? 'Audit Logs'
    : location.pathname.startsWith('/users')
    ? 'Users'
    : location.pathname.startsWith('/import')
    ? 'Data Import'
    : 'Settings';

  return (
    <div className="flex min-h-screen bg-[#0a0f18] text-slate-100">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-slate-950/95 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <Shield className="text-cyan-400" size={18} />
              <span className="font-semibold text-sm text-white">SecurePay</span>
            </Link>
            <p className="hidden lg:block text-sm font-semibold text-slate-200">{pageName}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs" aria-label="Service health">
            {[
              ['API', healthUnavailable ? 'Unavailable' : health ? serviceState('api') : 'Unknown'],
              ['Database', serviceState('database')],
              ['ML service', serviceState('mlService')],
            ].map(([label, state]) => (
              <span key={label} className="whitespace-nowrap">
                <span className="text-slate-500">{label}: </span>
                <span className={serviceColor(state)}>{state}</span>
              </span>
            ))}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '13px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#0f172a' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0f172a' },
          },
          duration: 3500,
        }}
      />
    </div>
  );
};
