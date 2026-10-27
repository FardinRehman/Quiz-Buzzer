import React from 'react';
import type { LeaderboardEntry } from '../types/quiz.js';
import { Trophy, Medal, Award, Flame, Zap, CheckCircle2 } from 'lucide-react';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  compact?: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  entries = [],
  currentUserId,
  compact = false,
}) => {
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-black font-black flex items-center justify-center shadow-md shadow-yellow-500/30 text-xs">
            <Trophy className="w-3.5 h-3.5 fill-black" />
          </div>
        );
      case 2:
        return (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-900 font-black flex items-center justify-center shadow-md text-xs">
            <Medal className="w-3.5 h-3.5" />
          </div>
        );
      case 3:
        return (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-white font-black flex items-center justify-center shadow-md text-xs">
            <Award className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 font-mono font-bold flex items-center justify-center text-xs border border-slate-700">
            #{rank}
          </div>
        );
    }
  };

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
        <p className="text-sm font-medium">No quiz points awarded yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          Points will appear here in real-time as contestants answer correctly!
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs text-slate-400 font-mono uppercase tracking-wider">
            <th className="py-2.5 px-3">Rank</th>
            <th className="py-2.5 px-3">Contestant</th>
            <th className="py-2.5 px-3 text-right">Crypto Points</th>
            {!compact && <th className="py-2.5 px-3 text-center">Correct</th>}
            {!compact && <th className="py-2.5 px-3 text-center">1st Wins</th>}
            {!compact && <th className="py-2.5 px-3 text-center">2nd Wins</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-sans">
          {entries.map((entry, idx) => {
            const isMe = currentUserId && entry.uid === currentUserId;
            return (
              <tr
                key={entry.uid || idx}
                className={`transition-colors ${
                  isMe
                    ? 'bg-cyan-950/40 border-l-2 border-cyan-400 text-white'
                    : 'hover:bg-slate-800/30 text-slate-200'
                }`}
              >
                {/* Rank */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">{getRankBadge(entry.rank || idx + 1)}</div>
                </td>

                {/* Name */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-100 truncate max-w-[160px] sm:max-w-xs">
                      {entry.displayName}
                    </span>
                    {entry.studentId && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({entry.studentId})
                      </span>
                    )}
                    {isMe && (
                      <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.2 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                </td>

                {/* Crypto Points */}
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1 font-extrabold font-mono text-cyan-400 text-sm sm:text-base">
                    <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>{Number(entry.totalCrypto || 0).toLocaleString()}</span>
                    <span className="text-xs text-slate-400 font-sans font-normal">Crypto</span>
                  </div>
                </td>

                {/* Correct Count */}
                {!compact && (
                  <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-300">
                    <div className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{entry.correctAnswersCount || 0}</span>
                    </div>
                  </td>
                )}

                {/* 1st Wins */}
                {!compact && (
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-400 font-semibold">
                    <div className="inline-flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      <span>{entry.firstBuzzerWins || 0}</span>
                    </div>
                  </td>
                )}

                {/* 2nd Wins */}
                {!compact && (
                  <td className="py-2.5 px-3 text-center font-mono text-indigo-300">
                    <span>{entry.secondBuzzerWins || 0}</span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
