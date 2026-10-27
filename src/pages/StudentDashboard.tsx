import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import { BuzzerButton } from '../components/BuzzerButton.js';
import { LeaderboardView } from '../components/LeaderboardView.js';
import { sound } from '../utils/audio.js';
import { apiUrl } from '../utils/api.js';
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
  Flame,
  CheckCircle2,
  XCircle,
  Award,
  Layers,
  Eye,
  AlertCircle,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user, token, logout, joinedSessionId } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string>(joinedSessionId || 'ses_main_2026');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted());
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const {
    session,
    currentRound,
    contestants,
    activeContestant,
    leaderboard,
    myScore,
    isConnected,
    isReconnecting,
    buzzStatus,
    buzzPosition,
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
      const res = await fetch(apiUrl('/api/sessions/join'), {
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

  // Helper for formatting round status text and styling
  const getRoundStatusDisplay = (status?: string) => {
    switch (status) {
      case 'QUESTION_ACTIVE':
      case 'OPEN':
        return {
          label: 'Question Active',
          badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse',
        };
      case 'BUZZER_LOCKED':
        return {
          label: 'Buzzer Locked',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'AWAITING_ANSWER_EVALUATION':
        return {
          label: 'Awaiting Answer Evaluation',
          badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse',
        };
      case 'ANSWER_CORRECT':
        return {
          label: 'Answer Correct',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'ANSWER_INCORRECT':
        return {
          label: 'Answer Incorrect',
          badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
        };
      case 'NEXT_CONTESTANT':
        return {
          label: 'Next Contestant',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse',
        };
      case 'QUESTION_COMPLETED':
        return {
          label: 'Question Completed',
          badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600',
        };
      case 'ROUND_COMPLETED':
      case 'CLOSED':
        return {
          label: 'Round Completed',
          badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        };
      case 'WAITING_TO_START':
      case 'IDLE':
      default:
        return {
          label: 'Waiting to Start',
          badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        };
    }
  };

  const statusDisplay = getRoundStatusDisplay(currentRound?.status);

  // My current participation status
  const getMyParticipationStatus = () => {
    if (buzzPosition === 1) {
      const c1 = contestants.find(c => c.position === 1);
      if (c1?.evaluation === 'correct') return 'Accepted 1st Contestant • Correct (+1,000 Crypto)';
      if (c1?.evaluation === 'wrong') return 'Accepted 1st Contestant • Incorrect (0 Crypto)';
      return 'Accepted 1st Contestant • Answering Now';
    }
    if (buzzPosition === 2) {
      const c2 = contestants.find(c => c.position === 2);
      if (c2?.evaluation === 'correct') return 'Accepted 2nd Contestant • Correct (+700 Crypto)';
      if (c2?.evaluation === 'wrong') return 'Accepted 2nd Contestant • Incorrect (0 Crypto)';
      return 'Accepted 2nd Contestant • On Deck';
    }
    if (buzzStatus === 'TOO_LATE') return 'Buzzed after Top 2 slots closed';
    if (currentRound?.status === 'QUESTION_ACTIVE' || currentRound?.status === 'OPEN') return 'Eligible to Buzz';
    return 'Waiting for question';
  };

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
                Student Arena
              </span>
            </div>
          </div>

          {/* Student Status & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Leaderboard Button */}
            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 text-indigo-300 hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-sm"
              title="View Live Leaderboard"
            >
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>

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
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4">
        {/* Prominent Crypto Score Card */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Your QuickBuzz Score</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
                  {Number(myScore?.totalCrypto ?? 0).toLocaleString()}
                </span>
                <span className="text-sm sm:text-base font-bold text-cyan-400 font-mono">Crypto</span>
              </div>
            </div>

            {/* Personal Stats Pill Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2 sm:px-3 sm:py-2">
                <span className="text-[10px] sm:text-xs text-slate-400 block font-medium">Correct</span>
                <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                  {myScore?.correctAnswersCount ?? 0}
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2 sm:px-3 sm:py-2">
                <span className="text-[10px] sm:text-xs text-slate-400 block font-medium">1st Wins</span>
                <span className="text-base sm:text-lg font-black text-cyan-400 font-mono">
                  {myScore?.firstBuzzerWins ?? 0}
                </span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2 sm:px-3 sm:py-2">
                <span className="text-[10px] sm:text-xs text-slate-400 block font-medium">2nd Wins</span>
                <span className="text-base sm:text-lg font-black text-indigo-400 font-mono">
                  {myScore?.secondBuzzerWins ?? 0}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Current Question & Round details */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono text-cyan-400 tracking-wider">Session</span>
              <span className="text-sm font-bold text-white truncate max-w-[240px] sm:max-w-md">
                {session?.title || 'QuickBuzz Quiz Session'}
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

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-mono text-slate-400">
                ROUND #{currentRound?.roundNumber || 1}
              </span>
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${statusDisplay.badgeClass}`}
              >
                {statusDisplay.label}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-snug">
              {currentRound?.questionText ? (
                currentRound.questionText
              ) : (
                <span className="italic text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-cyan-400 inline" />
                  Quizmaster is asking the question verbally or preparing the next round. Watch the screen!
                </span>
              )}
            </h2>

            {/* Revealed Answer Box (Shown only after admin explicitly reveals it) */}
            {currentRound?.isAnswerRevealed && currentRound.correctAnswer && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-300 block uppercase tracking-wider">
                    Official Answer Revealed
                  </span>
                  <span className="text-sm font-semibold text-white">{currentRound.correctAnswer}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Live Top-2 Contestants Status Bar */}
        {contestants.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contestant 1 */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                contestants[0].uid === user?.uid
                  ? 'bg-cyan-950/50 border-cyan-400 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-black text-xs flex items-center justify-center font-mono">
                  #1
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white truncate max-w-[140px]">
                      {contestants[0].displayName}
                    </span>
                    {contestants[0].uid === user?.uid && (
                      <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/20 px-1 rounded">YOU</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Clocked in at {contestants[0].latencyMs} ms
                  </span>
                </div>
              </div>

              <div>
                {contestants[0].evaluation === 'correct' ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                    +1,000 Crypto
                  </span>
                ) : contestants[0].evaluation === 'wrong' ? (
                  <span className="text-xs font-bold text-red-400 bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded">
                    Wrong (0 pts)
                  </span>
                ) : (
                  <span className="text-xs font-mono text-purple-300 bg-purple-950/50 border border-purple-500/30 px-2 py-0.5 rounded animate-pulse">
                    Evaluating...
                  </span>
                )}
              </div>
            </div>

            {/* Contestant 2 */}
            {contestants[1] ? (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  contestants[1].uid === user?.uid
                    ? 'bg-indigo-950/50 border-indigo-400 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-400 text-indigo-300 font-black text-xs flex items-center justify-center font-mono">
                    #2
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate max-w-[140px]">
                        {contestants[1].displayName}
                      </span>
                      {contestants[1].uid === user?.uid && (
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/20 px-1 rounded">YOU</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Clocked in at {contestants[1].latencyMs} ms
                    </span>
                  </div>
                </div>

                <div>
                  {contestants[1].evaluation === 'correct' ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                      +700 Crypto
                    </span>
                  ) : contestants[1].evaluation === 'wrong' ? (
                    <span className="text-xs font-bold text-red-400 bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded">
                      Wrong (0 pts)
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-indigo-300 bg-indigo-950/50 border border-indigo-500/30 px-2 py-0.5 rounded">
                      2nd In Line
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 flex items-center justify-center text-xs text-slate-500 font-mono">
                {currentRound?.status === 'OPEN' || currentRound?.status === 'QUESTION_ACTIVE'
                  ? 'Contestant #2 slot is OPEN! Buzz now!'
                  : 'No second contestant buzzed'}
              </div>
            )}
          </section>
        )}

        {/* Buzz Error banner if any */}
        {buzzError && (
          <div className="bg-red-950/50 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{buzzError}</span>
          </div>
        )}

        {/* Central Buzzer Button Stage */}
        <div className="flex-1 flex flex-col items-center justify-center my-4">
          <BuzzerButton
            currentRound={currentRound}
            buzzStatus={buzzStatus}
            buzzPosition={buzzPosition}
            isConnected={isConnected}
            onBuzz={submitBuzz}
            winnerInfo={lastWinnerInfo}
            contestants={contestants}
          />
        </div>

        {/* Current Round Participation Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-500">Your Round Status:</span>
            <span className="font-semibold text-slate-200">{getMyParticipationStatus()}</span>
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>{showHistory ? 'Hide Activity' : `My History (${myScore?.recentActivity?.length || 0})`}</span>
          </button>
        </div>

        {/* Personal Activity Section */}
        {showHistory && (
          <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 max-h-64 overflow-y-auto">
            <h3 className="text-xs font-bold font-mono uppercase text-slate-300 mb-3 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Personal Quiz Activity & Crypto Points Earned</span>
            </h3>

            {!myScore?.recentActivity || myScore.recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No recent question attempts yet.</p>
            ) : (
              <div className="space-y-2">
                {myScore.recentActivity.map((act, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold">R#{act.roundNumber}</span>
                      <span className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-md">
                        {act.questionText || `Question #${act.roundNumber}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {act.position && (
                        <span className="font-mono text-[11px] text-slate-400">
                          Pos #{act.position}
                        </span>
                      )}
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          act.points > 0
                            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {act.points > 0 ? `+${act.points} Crypto` : '0 Crypto'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Live Leaderboard Modal */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-base font-bold text-white">Live Leaderboard</h3>
              </div>
              <button
                onClick={() => setIsLeaderboardOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <LeaderboardView entries={leaderboard} currentUserId={user?.uid} />
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-center text-xs text-slate-400">
              Rankings update automatically when answers are verified by the host.
            </div>
          </div>
        </div>
      )}

      {/* Join Session Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                <span>Join Another Quiz Session</span>
              </h3>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinSession} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Session PIN / Code
                </label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. BUZZ99"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white font-mono text-sm uppercase tracking-wider outline-none"
                  autoFocus
                />
              </div>

              {joinError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 p-2 rounded-lg">
                  {joinError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
