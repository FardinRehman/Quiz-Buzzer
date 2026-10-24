import React from 'react';
import type { Round } from '../types/quiz.js';
import { Trophy, Clock, Lock, Zap, AlertCircle } from 'lucide-react';

interface BuzzerButtonProps {
  currentRound: Round | null;
  buzzStatus: 'IDLE' | 'SENDING' | 'WON' | 'TOO_LATE' | 'ROUND_CLOSED' | 'ERROR';
  isConnected: boolean;
  onBuzz: () => void;
  winnerInfo: {
    name: string;
    studentId: string;
    latencyMs: number | null;
  } | null;
}

export const BuzzerButton: React.FC<BuzzerButtonProps> = ({
  currentRound,
  buzzStatus,
  isConnected,
  onBuzz,
  winnerInfo,
}) => {
  const isRoundOpen = currentRound?.status === 'OPEN';
  const isWinnerLocked = currentRound?.status === 'WINNER_LOCKED';
  const isIdle = !currentRound || currentRound.status === 'IDLE';

  // Determine button state
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

  // STATE C: Student won
  if (buzzStatus === 'WON') {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 border-4 border-emerald-400 flex flex-col items-center justify-center text-white shadow-2xl animate-winner-glow transform hover:scale-102 transition-transform duration-300">
          <Trophy className="w-14 h-14 text-yellow-300 mb-2 drop-shadow-md animate-bounce" />
          <span className="text-xl sm:text-2xl font-black tracking-wide uppercase">YOU BUZZED FIRST!</span>
          {winnerInfo?.latencyMs !== null && (
            <div className="mt-2 flex items-center gap-1.5 bg-black/40 px-3.5 py-1 rounded-full text-emerald-200 text-xs sm:text-sm font-mono font-bold tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>{winnerInfo?.latencyMs} ms</span>
            </div>
          )}
          <span className="text-xs text-emerald-100/90 mt-2 font-medium tracking-wide">Locked In As Winner</span>
        </div>
      </div>
    );
  }

  // STATE D: Another student won
  if (buzzStatus === 'TOO_LATE' || isWinnerLocked) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-slate-900 border-2 border-amber-500/50 flex flex-col items-center justify-center text-slate-300 shadow-xl p-4">
          <Clock className="w-10 h-10 text-amber-400 mb-2" />
          <span className="text-lg sm:text-xl font-bold tracking-wide uppercase text-amber-400">TOO LATE!</span>
          {winnerInfo ? (
            <div className="mt-2 text-center max-w-[200px]">
              <span className="text-xs text-slate-400 block">First Buzz Accepted:</span>
              <span className="text-sm font-semibold text-white truncate block">{winnerInfo.name}</span>
              <span className="text-xs text-cyan-400 font-mono block">({winnerInfo.studentId})</span>
              {winnerInfo.latencyMs !== null && (
                <span className="text-xs text-slate-400 font-mono mt-1 block">{winnerInfo.latencyMs} ms response</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 mt-1">Another contestant claimed first buzz</span>
          )}
        </div>
      </div>
    );
  }

  // STATE B: Round is OPEN - Ready to BUZZ!
  if (isRoundOpen) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <button
          onClick={onBuzz}
          disabled={buzzStatus === 'SENDING'}
          className="relative group w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-gradient-to-tr from-cyan-600 via-cyan-500 to-indigo-600 active:from-cyan-700 active:to-indigo-700 text-white font-extrabold shadow-2xl cursor-pointer border-4 border-cyan-300 transform active:scale-95 hover:scale-103 transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-cyan-400/60 animate-pulse-ring"
          aria-label="Buzz Now"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <Zap className="w-14 h-14 text-yellow-300 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-2xl sm:text-3xl font-black tracking-widest uppercase drop-shadow-md">
              {buzzStatus === 'SENDING' ? 'BUZZING...' : 'BUZZ NOW!'}
            </span>
            <span className="text-xs tracking-wider text-cyan-100/90 font-medium uppercase">
              First click takes the round
            </span>
          </div>
        </button>
      </div>
    );
  }

  // STATE E: Round Closed
  if (currentRound?.status === 'CLOSED') {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-slate-900/80 border border-slate-700 flex flex-col items-center justify-center text-slate-500 shadow-inner">
          <Lock className="w-10 h-10 text-slate-500 mb-2" />
          <span className="text-lg font-bold tracking-wider uppercase">ROUND CLOSED</span>
          <span className="text-xs text-slate-500 mt-1">Stand by for next question</span>
        </div>
      </div>
    );
  }

  // STATE A: Idle / Waiting for question
  return (
    <div className="flex flex-col items-center justify-center p-4 text-center">
      <div
        className="w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center text-slate-400 shadow-inner select-none cursor-not-allowed opacity-80"
        title="Waiting for administrator to open buzzer"
      >
        <Lock className="w-8 h-8 text-slate-500 mb-2" />
        <span className="text-base sm:text-lg font-bold tracking-wider uppercase text-slate-300">
          WAIT FOR QUESTION
        </span>
        <span className="text-xs text-slate-500 mt-1 max-w-[180px]">
          {isIdle ? 'Quizmaster will unlock buzzer' : 'Stand by'}
        </span>
      </div>
    </div>
  );
};
