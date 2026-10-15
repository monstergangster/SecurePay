import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  ArrowLeftRight,
  ShieldAlert,
  FolderOpen,
  Users,
  BarChart3,
  Cpu,
  UploadCloud,
  ScrollText,
  UserCog,
  Settings,
  Shield,
  LogOut,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navGroups = [
    {
      group: 'MONITOR',
      items: [
        { label: 'Command Center', to: '/', icon: LayoutDashboard },
        { label: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
        { label: 'Threat Center', to: '/alerts', icon: ShieldAlert },
      ],
    },
    {
      group: 'INVESTIGATE',
      items: [
        { label: 'Cases', to: '/cases', icon: FolderOpen },
        { label: 'Customers', to: '/customers', icon: Users },
      ],
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { label: 'Behaviour Analytics', to: '/analytics', icon: BarChart3 },
        ...(isAdmin
          ? [{ label: 'Detection Engine', to: '/rules', icon: Cpu }]
          : []),
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { label: 'Data Import', to: '/import', icon: UploadCloud },
        ...(isAdmin
          ? [
              { label: 'Audit Trail', to: '/audit', icon: ScrollText },
              { label: 'Users', to: '/users', icon: UserCog },
            ]
          : []),
        { label: 'Settings', to: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-slate-950/95 border-r border-slate-800/90 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-950">
              <Shield className="text-white" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-white tracking-wider font-mono">SECUREPAY</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-cyan-950 text-cyan-400 border border-cyan-800/60 rounded">SOC</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 tracking-wider">FRAUD INTELLIGENCE</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Grouped Nav Items */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-5">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              <p className="px-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold mb-1.5">
                {group.group}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 shadow-sm shadow-cyan-950'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                    }`
                  }
                >
                  <item.icon size={16} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User Profile & Session Controls */}
        <div className="border-t border-slate-800/80 p-3 bg-slate-950/60">
          <NavLink
            to="/settings"
            onClick={() => onClose && onClose()}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-900 transition-colors mb-1.5"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center text-cyan-400 text-xs font-bold font-mono flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[11px] font-mono text-slate-400 capitalize">{user?.role} Role</p>
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors border border-transparent hover:border-rose-900/30"
          >
            <LogOut size={13} /> Terminate Session
          </button>
        </div>
      </aside>
    </>
  );
};
