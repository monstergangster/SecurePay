import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import TransactionDetail from './pages/TransactionDetail';
import Alerts from './pages/Alerts';
import AlertDetail from './pages/AlertDetail';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Analytics from './pages/Analytics';
import Import from './pages/Import';
import Rules from './pages/Rules';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AccessDenied from './pages/AccessDenied';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/:id" element={<TransactionDetail />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/alerts/:id" element={<AlertDetail />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/cases/:id" element={<CaseDetail />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:customerId" element={<CustomerDetail />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/import" element={<Import />} />
              <Route path="/settings" element={<Settings />} />

              {/* Admin Protected Routes */}
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/rules" element={<Rules />} />
                <Route path="/audit" element={<AuditLogs />} />
                <Route path="/users" element={<Users />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
