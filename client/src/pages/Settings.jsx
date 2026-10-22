import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock } from 'lucide-react';
import api from '../services/api';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/ui/PageHeader';

export default function Settings() {
  const { user } = useAuth();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [updating, setUpdating] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setUpdating(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Access password updated successfully.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Account Settings"
        description="Review your account details and update your password."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>OPERATOR PROFILE</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-50 to-blue-800 border border-blue-700/60 flex items-center justify-center text-blue-700 text-lg font-bold font-mono">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">{user?.name}</p>
                <p className="text-xs font-mono text-blue-700 capitalize">{user?.role} Role</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-slate-500 font-mono text-[10px] uppercase">Email Identity</p>
                <p className="text-slate-800 font-mono mt-0.5">{user?.email}</p>
              </div>
              <div>
                <p className="text-slate-500 font-mono text-[10px] uppercase">Internal Identity Hash</p>
                <p className="text-slate-600 font-mono text-[11px] mt-0.5">{user?._id || user?.id || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                {user?.role === 'admin'
                  ? 'Active Scope: Full platform administration, detection engine weights, user provisioning, and audit oversight.'
                  : 'Active Scope: Real-time transaction surveillance, alert evaluation, case investigations, and report extraction.'}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CREDENTIAL ROTATION</CardTitle>
          </CardHeader>
          <form onSubmit={handlePasswordChange} className="space-y-3.5">
            <Input
              label="Current Access Password"
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
            />
            <Input
              label="New Access Password"
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              required
            />
            <div className="pt-2">
              <Button type="submit" size="sm" loading={updating} className="w-full justify-center text-xs">
                <Lock size={13} /> Rotate Access Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
