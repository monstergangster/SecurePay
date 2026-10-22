import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
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
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose, collapsed = false }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const auditRecorded = await logout();
    if (auditRecorded) {
      toast.success('Signed out locally. Any copied token remains valid until it expires.');
    } else {
      toast.error('Signed out locally, but the server could not record the logout. Any copied token remains valid until it expires.');
    }
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
      group: 'INSIGHTS',
      items: [
        { label: 'Behaviour Analytics', to: '/analytics', icon: BarChart3 },
        ...(isAdmin
          ? [{ label: 'Rules', to: '/rules', icon: Cpu }]
          : []),
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { label: 'Data Import', to: '/import', icon: UploadCloud },
        ...(isAdmin
          ? [
              { label: 'Audit Logs', to: '/audit', icon: ScrollText },
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
          className="fixed inset-0 bg-white/40 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 ${collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64'} bg-white border-r border-slate-200 flex flex-col z-50 transition-[width,transform] duration-200 ease-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-5'} border-b border-slate-200`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <Shield className="text-slate-900" size={20} />
            </div>
            {!collapsed && <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 tracking-wide">SecurePay</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded">SOC</span>
              </div>
              <p className="text-[10px] text-slate-500">Fraud monitoring</p>
            </div>}
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Grouped Nav Items */}
        <nav className={`flex-1 py-4 ${collapsed ? 'px-2' : 'px-3'} overflow-y-auto space-y-5`}>
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              {!collapsed && <p className="px-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                {group.group}
              </p>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User Profile & Session Controls */}
        <div className={`border-t border-slate-200 p-3 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          <NavLink
            to="/settings"
            onClick={() => onClose && onClose()}
            title={collapsed ? `${user?.name || 'User'} — ${user?.role || 'role'}` : undefined}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} p-2 rounded-lg hover:bg-slate-100 transition-colors mb-1.5`}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-[11px] font-mono text-slate-500 capitalize">{user?.role} Role</p>
            </div>}
          </NavLink>

          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            aria-label="Sign out"
            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ${collapsed ? 'w-10' : 'w-full'}`}
          >
            <LogOut size={15} /> {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  );
};
