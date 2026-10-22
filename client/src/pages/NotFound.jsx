import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 mb-4">
        <HelpCircle size={32} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">404 - Module Not Found</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6">
        The requested URL endpoint or resource does not exist in the SecurePay console.
      </p>
      <Link to="/">
        <Button size="sm">Go to Dashboard</Button>
      </Link>
    </div>
  );
}
