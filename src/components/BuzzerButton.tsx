import React from 'react';
import type { Round, Contestant } from '../types/quiz.js';
import type { LiveBuzzStatus } from '../hooks/useLiveSession.js';
import { Trophy, Clock, Lock, Zap, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface BuzzerButtonProps {
  currentRound: Round | null;
  buzzStatus: LiveBuzzStatus;
  buzzPosition?: 1 | 2 | null;
  isConnected: boolean;
  onBuzz: () => void;
  winnerInfo?: {
    name: string;
    studentId: string;
    latencyMs: number | null;
  } | null;
  contestants?: Contestant[];
}

export const BuzzerButton: React.FC<BuzzerButtonProps> = ({
  currentRound,
  buzzStatus,
  buzzPosition,
  isConnected,
  onBuzz,
  winnerInfo,
  contestants = [],
}) => {
  const isRoundActive =
    currentRound?.status === 'OPEN' ||
    currentRound?.status === 'QUESTION_ACTIVE' ||
    (currentRound?.status === 'AWAITING_ANSWER_EVALUATION' && contestants.length < 2);

  const isBuzzerLocked =
    currentRound?.status === 'BUZZER_LOCKED' ||
    currentRound?.status === 'WINNER_LOCKED' ||
    currentRound?.status === 'QUESTION_COMPLETED' ||
    currentRound?.status === 'ROUND_COMPLETED' ||
    currentRound?.status === 'CLOSED';

  // 1. Connection Error
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full border-2 border-red-500/40 bg-red-950/20 flex flex-col items-center justify-center text-red-400 p-6 shadow-inner">
          <AlertCircle className="w-12 h-12 mb-3 animate-pulse" />
          <span className="font-bold tracking-wider text-base uppercase">Connection Lost</span>
          <span className="text-xs text-red-300/70 mt-1">Reconnecting to server...</span>
        </div>
      </div>
    );
  }

  // 2. You are First Contestant!
  if (buzzStatus === 'ACCEPTED_FIRST' || buzzPosition === 1 || buzzStatus === 'WON') {
    const myContestant = contestants.find(c => c.position === 1);
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 border-4 border-emerald-300 flex flex-col items-center justify-center text-white shadow-2xl animate-winner-glow">
          <Trophy className="w-14 h-14 text-yellow-300 mb-2 drop-shadow-md animate-bounce" />
          <span className="text-lg sm:text-xl font-black tracking-wide uppercase">YOU ARE CONTESTANT #1</span>
          <span className="text-xs text-emerald-100 font-mono font-bold mt-1 bg-black/30 px-3 py-0.5 rounded-full">
            Position: 1st Buzzer Accepted
          </span>
          {myContestant?.latencyMs !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 bg-black/40 px-3.5 py-1 rounded-full text-emerald-200 text-xs font-mono font-bold">
              <Clock className="w-3.5 h-3.5 text-cyan-300" />
              <span>{myContestant.latencyMs} ms latency</span>
            </div>
          )}
          <span className="text-[11px] text-emerald-200 mt-2 font-medium">Prepare to give your verbal answer!</span>
        </div>
        <p className="mt-3 text-xs font-mono font-semibold text-emerald-400">You are the first contestant.</p>
      </div>
    );
  }

  // 3. You are Second Contestant!
  if (buzzStatus === 'ACCEPTED_SECOND' || buzzPosition === 2) {
    const myContestant = contestants.find(c => c.position === 2);
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 border-4 border-indigo-300 flex flex-col items-center justify-center text-white shadow-2xl">
          <CheckCircle2 className="w-14 h-14 text-indigo-200 mb-2 drop-shadow-md" />
          <span className="text-lg sm:text-xl font-black tracking-wide uppercase">YOU ARE CONTESTANT #2</span>
          <span className="text-xs text-indigo-100 font-mono font-bold mt-1 bg-black/30 px-3 py-0.5 rounded-full">
            Position: 2nd Buzzer Accepted
          </span>
          {myContestant?.latencyMs !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 bg-black/40 px-3.5 py-1 rounded-full text-indigo-200 text-xs font-mono font-bold">
              <Clock className="w-3.5 h-3.5 text-cyan-300" />
              <span>{myContestant.latencyMs} ms latency</span>
            </div>
          )}
          <span className="text-[11px] text-indigo-200 mt-2 font-medium">Ready if Contestant #1 answers incorrectly</span>
        </div>
        <p className="mt-3 text-xs font-mono font-semibold text-indigo-400">You are the second contestant.</p>
      </div>
    );
  }

  // 4. Request in Flight (Sending)
  if (buzzStatus === 'SENDING') {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-cyan-900/60 border-4 border-cyan-400 flex flex-col items-center justify-center text-cyan-200 shadow-xl animate-pulse">
          <Zap className="w-12 h-12 text-yellow-300 mb-2 animate-spin" />
          <span className="text-lg sm:text-xl font-black tracking-wide uppercase">RECORDING...</span>
          <span className="text-xs text-cyan-300/80 mt-1">Authoritative timestamp verification</span>
        </div>
        <p className="mt-3 text-xs font-mono font-semibold text-cyan-300">Your buzzer has been recorded.</p>
      </div>
    );
  }

  // 5. Too Late / Not in Top 2
  if (buzzStatus === 'TOO_LATE' || (isBuzzerLocked && !buzzPosition && currentRound?.status !== 'IDLE')) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-slate-900 border-2 border-amber-500/50 flex flex-col items-center justify-center text-slate-300 shadow-xl p-4">
          <Clock className="w-10 h-10 text-amber-400 mb-2" />
          <span className="text-base sm:text-lg font-bold tracking-wide uppercase text-amber-400">
            NOT IN TOP 2
          </span>
          <span className="text-xs text-slate-400 mt-2 max-w-[200px]">
            The first two contestant spots for this question have already been locked.
          </span>
        </div>
        <p className="mt-3 text-xs font-mono font-semibold text-amber-400">
          You were not among the first two contestants.
        </p>
      </div>
    );
  }

  // 6. Round Active & Ready to BUZZ!
  if (isRoundActive && !buzzPosition) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <button
          onClick={onBuzz}
          className="relative group w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-gradient-to-tr from-cyan-600 via-cyan-500 to-indigo-600 active:from-cyan-700 active:to-indigo-700 text-white font-extrabold shadow-2xl cursor-pointer border-4 border-cyan-300 transform active:scale-95 hover:scale-103 transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-cyan-400/60 animate-pulse-ring"
          aria-label="Buzz Now"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <Zap className="w-14 h-14 text-yellow-300 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-2xl sm:text-3xl font-black tracking-widest uppercase drop-shadow-md">
              BUZZ NOW!
            </span>
            <span className="text-xs tracking-wider text-cyan-100 font-medium uppercase">
              Top 2 Fastest Buzzes Accepted
            </span>
          </div>
        </button>
        <p className="mt-3 text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          Your buzzer is ready.
        </p>
      </div>
    );
  }

  // 7. Buzzer Locked / Round Idle
  return (
    <div className="flex flex-col items-center justify-center p-4 text-center">
      <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-slate-900/80 border border-slate-700 flex flex-col items-center justify-center text-slate-500 shadow-inner">
        <Lock className="w-10 h-10 text-slate-500 mb-2" />
        <span className="text-base sm:text-lg font-bold tracking-wider uppercase">BUZZER LOCKED</span>
        <span className="text-xs text-slate-500 mt-1">Waiting for host to activate question</span>
      </div>
      <p className="mt-3 text-xs font-mono font-semibold text-slate-500">The buzzer is currently locked.</p>
    </div>
  );
};
