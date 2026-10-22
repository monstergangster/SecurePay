import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sp_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (token) {
      api.get('/auth/me')
        .then(res => { setUser(res.data.data); localStorage.setItem('sp_user', JSON.stringify(res.data.data)); })
        .catch(() => { localStorage.removeItem('sp_token'); localStorage.removeItem('sp_user'); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data.data;
    localStorage.setItem('sp_token', token);
    localStorage.setItem('sp_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    let auditRecorded = false;
    try {
      await api.post('/auth/logout');
      auditRecorded = true;
    } catch {
      auditRecorded = false;
    } finally {
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
      setUser(null);
    }
    return auditRecorded;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
