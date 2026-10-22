import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function AccessDenied() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 mb-4">
        <ShieldAlert size={32} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6">
        You do not possess the required role permissions to view or modify this platform module. All unauthorized navigation attempts are recorded.
      </p>
      <Link to="/">
        <Button size="sm">Return to Dashboard</Button>
      </Link>
    </div>
  );
}
