import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import { BuzzerButton } from '../components/BuzzerButton.js';
import { sound } from '../utils/audio.js';
import {
  Zap,
  LogOut,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  User,
  History,
  Trophy,
  HelpCircle,
  Hash,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user, token, logout, joinedSessionId } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string>(joinedSessionId || 'ses_main_2026');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted());
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const {
    session,
    currentRound,
    isConnected,
    isReconnecting,
    buzzStatus,
    buzzError,
    lastWinnerInfo,
    submitBuzz,
  } = useLiveSession({
    token,
    sessionId: activeSessionId,
    userRole: 'student',
    userId: user?.uid,
  });

  const toggleSound = () => {
    const nextMuted = !isMuted;
    sound.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!joinCodeInput.trim()) return;

    try {
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionCode: joinCodeInput.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Failed to join session');
        return;
      }
      setActiveSessionId(data.sessionId);
      setIsJoinModalOpen(false);
      setJoinCodeInput('');
    } catch {
      setJoinError('Network error trying to join session');
    }
  };

  // Filter personal buzz attempts in this session
  const myAttempts = session
    ? Object.values(session.rounds)
        .flatMap(r =>
          r.attempts
            .filter(a => a.uid === user?.uid)
            .map(a => ({
              ...a,
              roundNumber: r.roundNumber,
              questionText: r.questionText,
            }))
        )
        .reverse()
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                QuickBuzz
              </span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400 ml-2 font-mono">
                Student Console
              </span>
            </div>
          </div>

          {/* Student Status & Controls */}
          <div className="flex items-center gap-3">
            {/* Connection Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
                isConnected
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-red-950/40 border-red-500/40 text-red-400 animate-pulse'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">LIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>{isReconnecting ? 'RECONNECTING' : 'OFFLINE'}</span>
                </>
              )}
            </div>

            {/* Mute Button */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Student ID chip */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60 text-xs">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <div className="leading-tight">
                <span className="font-semibold text-slate-200 block">{user?.displayName}</span>
                <span className="text-[10px] text-slate-400 font-mono">{user?.studentId}</span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-red-950/50 hover:text-red-400 text-slate-400 transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col justify-between">
        {/* Session & Question Header Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono text-cyan-400 tracking-wider">Session</span>
              <span className="text-sm font-bold text-white truncate max-w-[260px] sm:max-w-md">
                {session?.title || 'Loading Quiz Session...'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="text-xs font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 hover:border-cyan-500 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Hash className="w-3 h-3 text-cyan-400" />
                <span>CODE: {session?.sessionCode || '------'}</span>
                <ChevronRight className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          </div>

          {/* Current Question & Round details */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-1">
                <span>ROUND #{currentRound?.roundNumber || 1}</span>
                <span>•</span>
                <span
                  className={
                    currentRound?.status === 'OPEN'
                      ? 'text-cyan-400 font-bold animate-pulse'
                      : currentRound?.status === 'WINNER_LOCKED'
                      ? 'text-emerald-400 font-bold'
                      : 'text-slate-400'
                  }
                >
                  STATUS: {currentRound?.status || 'IDLE'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-medium text-slate-100">
                {currentRound?.questionText ? (
                  currentRound.questionText
                ) : (
                  <span className="italic text-slate-400 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-cyan-400 inline" />
                    Quizmaster is asking the question verbally. Watch the host!
                  </span>
                )}
              </h2>
            </div>
          </div>
        </div>

        {/* Buzz Error banner if any */}
        {buzzError && (
          <div className="mt-3 bg-red-950/50 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <span className="font-bold">Error:</span> {buzzError}
          </div>
        )}

        {/* Central Buzzer Button Stage */}
        <div className="flex-1 flex flex-col items-center justify-center my-6">
          <BuzzerButton
            currentRound={currentRound}
            buzzStatus={buzzStatus}
            isConnected={isConnected}
            onBuzz={submitBuzz}
            winnerInfo={lastWinnerInfo}
          />
        </div>

        {/* Winner Announcement or Round Guidance */}
        <div className="mt-2">
          {lastWinnerInfo ? (
            <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 sm:p-4 text-center shadow-lg">
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-wider mb-1">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span>Round #{currentRound?.roundNumber} Winner Announced</span>
              </div>
              <div className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <span>{lastWinnerInfo.name}</span>
                <span className="text-xs text-cyan-400 font-mono">({lastWinnerInfo.studentId})</span>
              </div>
              {lastWinnerInfo.latencyMs !== null && (
                <div className="text-xs text-slate-400 font-mono mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Clocked in at {lastWinnerInfo.latencyMs} ms after round opened</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 py-2 font-mono">
              Keep your finger steady. First valid click atomically registered wins the round.
            </div>
          )}
        </div>

        {/* Bottom Drawer Toggle for My History */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {user?.displayName} ({user?.studentId})
            </span>
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>{showHistory ? 'Hide My Attempts' : `My Attempts (${myAttempts.length})`}</span>
          </button>
        </div>

        {/* Expandable History Drawer */}
        {showHistory && (
          <div className="mt-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4 max-h-60 overflow-y-auto">
            <h3 className="text-xs font-bold font-mono uppercase text-slate-300 mb-3 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Personal Round History</span>
            </h3>

            {myAttempts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No buzz submissions yet in this session.</p>
            ) : (
              <div className="space-y-2">
                {myAttempts.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-200">Round #{att.roundNumber}</span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {new Date(att.submittedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-bold font-mono ${
                          att.status === 'ACCEPTED_WINNER'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {att.status === 'ACCEPTED_WINNER' ? 'WON (FIRST)' : 'TOO LATE'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        Latency: {att.latencyMs} ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Join Session Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Join Quiz Session
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the unique session code provided by your quiz administrator or lecturer.
            </p>

            <form onSubmit={handleJoinSession} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-300 uppercase block mb-1">Session Code</label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. BUZZ99"
                  maxLength={10}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 font-mono text-lg text-white uppercase tracking-wider outline-none"
                  autoFocus
                />
              </div>

              {joinError && <div className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg">{joinError}</div>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-md cursor-pointer transition-colors"
                >
                  Switch Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
