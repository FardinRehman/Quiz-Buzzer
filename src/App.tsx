/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { StudentDashboard } from './pages/StudentDashboard.js';
import { Zap } from 'lucide-react';

const MainRouter: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse mb-4">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
          INITIALIZING QUICKBUZZ...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  return <StudentDashboard />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
