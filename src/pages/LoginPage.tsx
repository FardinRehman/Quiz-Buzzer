import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { Zap, Shield, ArrowRight, Lock, Hash, Sparkles, X } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, quickJoinStudent } = useAuth();

  // Contestant Quick-Join Form
  const [studentName, setStudentName] = useState('');
  const [sessionPin, setSessionPin] = useState('BUZZ99');
  const [studentId, setStudentId] = useState('');

  // Host Admin Modal & Form
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [contestantError, setContestantError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contestant enters quiz with Name and PIN
  const handleContestantJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setContestantError(null);
    if (!studentName.trim()) {
      setContestantError('Please enter your name to join.');
      return;
    }
    if (!sessionPin.trim()) {
      setContestantError('Please enter the session PIN.');
      return;
    }

    setIsSubmitting(true);
    const result = await quickJoinStudent(
      studentName.trim(),
      sessionPin.trim().toUpperCase(),
      studentId.trim() || undefined
    );
    setIsSubmitting(false);

    if (!result.success) {
      setContestantError(result.error || 'Failed to join quiz session');
    }
  };

  // Admin logs into quizmaster control center
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAdminError('Please provide administrator credentials.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(adminEmail.trim(), adminPassword);
    setIsSubmitting(false);

    if (!result.success) {
      setAdminError(result.error || 'Admin authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-4 selection:bg-cyan-500 selection:text-black">
      {/* Background radial glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full" />

      {/* Main Contestant Join Container */}
      <div className="relative w-full max-w-md my-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-xl shadow-cyan-500/20 mb-3">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-200 to-white bg-clip-text text-transparent">
            QuickBuzz
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Fastest Finger First Quiz Arena
          </p>
        </div>

        {/* Contestant Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleContestantJoin} className="space-y-4">
            <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-xl p-3 text-xs text-cyan-300/90 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Enter your name and the session PIN to participate.</span>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 uppercase block mb-1.5">
                Your Full Name
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="e.g. Alex Turner"
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 uppercase block mb-1.5 flex justify-between">
                <span>Session PIN</span>
                <span className="text-cyan-400 font-mono text-[11px]">Check Screen</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={sessionPin}
                  onChange={e => setSessionPin(e.target.value.toUpperCase())}
                  placeholder="e.g. BUZZ99"
                  className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono uppercase tracking-wider placeholder-slate-600 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 uppercase block mb-1.5 flex justify-between">
                <span>Roll No / Student ID</span>
                <span className="text-slate-500 text-[10px]">Optional</span>
              </label>
              <input
                type="text"
                value={studentId}
                onChange={e => setStudentId(e.target.value.toUpperCase())}
                placeholder="e.g. 1MS21CS042"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2 text-xs text-white font-mono uppercase placeholder-slate-600 outline-none transition-all"
              />
            </div>

            {contestantError && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 p-3 rounded-xl flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-red-400" />
                <span>{contestantError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 active:scale-98 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm tracking-wide"
            >
              <span>{isSubmitting ? 'Joining Quiz...' : 'ENTER BUZZER ARENA'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Tiny, Discreet Host Admin Portal Link at the Very Bottom */}
      <footer className="w-full max-w-md pt-4 pb-2 text-center">
        <button
          type="button"
          onClick={() => {
            setShowAdminModal(true);
            setAdminError(null);
          }}
          className="text-[10px] text-slate-600 hover:text-slate-400 font-mono transition-colors inline-flex items-center gap-1 opacity-60 hover:opacity-100 cursor-pointer py-1 px-2 rounded"
          title="Host Administration"
        >
          <Shield className="w-3 h-3" />
          <span>Host Portal</span>
        </button>
      </footer>

      {/* Host Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-fadeIn">
            <button
              type="button"
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Quizmaster Host Portal</h3>
                <span className="text-[11px] text-slate-400 font-mono">Restricted Access</span>
              </div>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-300 uppercase block mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="fardinrit@gmail.com"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 uppercase block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none"
                />
              </div>

              {adminError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 p-2.5 rounded-lg flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  <span>{adminError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-md cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Verifying...' : 'Sign In as Host'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
