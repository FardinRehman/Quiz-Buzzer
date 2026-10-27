import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  QuizSession,
  Round,
  Participant,
  BuzzAttempt,
  BuzzResponse,
  Contestant,
  LeaderboardEntry,
  StudentScoreSummary,
} from '../types/quiz.js';
import { sound } from '../utils/audio.js';
import confetti from 'canvas-confetti';
import { apiUrl } from '../utils/api.js';

interface UseLiveSessionProps {
  token: string | null;
  sessionId: string | null;
  userRole?: 'admin' | 'student';
  userId?: string;
}

export type LiveBuzzStatus =
  | 'IDLE'
  | 'SENDING'
  | 'ACCEPTED_FIRST'
  | 'ACCEPTED_SECOND'
  | 'TOO_LATE'
  | 'ROUND_CLOSED'
  | 'ALREADY_BUZZED'
  | 'ERROR'
  | 'WON';

export function useLiveSession({ token, sessionId, userRole, userId }: UseLiveSessionProps) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [attempts, setAttempts] = useState<BuzzAttempt[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myScore, setMyScore] = useState<StudentScoreSummary | null>(null);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [buzzStatus, setBuzzStatus] = useState<LiveBuzzStatus>('IDLE');
  const [buzzPosition, setBuzzPosition] = useState<1 | 2 | null>(null);
  const [buzzError, setBuzzError] = useState<string | null>(null);
  const [lastWinnerInfo, setLastWinnerInfo] = useState<{
    name: string;
    studentId: string;
    latencyMs: number | null;
  } | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Trigger celebration confetti
  const triggerCelebration = useCallback(() => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#10b981', '#8b5cf6', '#fbbf24', '#f59e0b'],
      });
    } catch {
      // ignore
    }
  }, []);

  // Fetch private personal score for authenticated student
  const fetchMyScore = useCallback(async () => {
    if (!token || userRole !== 'student') return;
    try {
      const res = await fetch(apiUrl('/api/students/me/score'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyScore(data.score);
      }
    } catch (err) {
      console.error('Failed to fetch personal score:', err);
    }
  }, [token, userRole]);

  // Fetch public leaderboard
  const fetchLeaderboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/leaderboard'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  }, [token]);

  const connectSSE = useCallback(() => {
    if (!token || !sessionId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = apiUrl(
      `/api/live/stream?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`
    );
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };

    es.onerror = () => {
      setIsConnected(false);
      setIsReconnecting(true);
      es.close();

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectSSE();
      }, 3000);
    };

    // Initial state snapshot
    es.addEventListener('state', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSession(data.session);
        setCurrentRound(data.currentRound);
        if (data.session?.participants) {
          setParticipants(data.session.participants);
        }
        if (data.currentRound?.attempts) {
          setAttempts(data.currentRound.attempts);
        }
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }

        // Determine student's existing position in current round if already buzzed
        if (userId && data.currentRound?.contestants) {
          const myContestant = data.currentRound.contestants.find((c: Contestant) => c.uid === userId);
          if (myContestant) {
            setBuzzPosition(myContestant.position);
            setBuzzStatus(myContestant.position === 1 ? 'ACCEPTED_FIRST' : 'ACCEPTED_SECOND');
          } else if (data.currentRound.attempts?.some((a: BuzzAttempt) => a.uid === userId)) {
            setBuzzStatus('TOO_LATE');
          } else if (
            data.currentRound.status === 'QUESTION_COMPLETED' ||
            data.currentRound.status === 'ROUND_COMPLETED' ||
            data.currentRound.status === 'CLOSED' ||
            data.currentRound.contestants.length >= 2
          ) {
            setBuzzStatus('ROUND_CLOSED');
          } else {
            setBuzzStatus('IDLE');
          }
        }

        if (data.currentRound?.winnerNameSnapshot) {
          setLastWinnerInfo({
            name: data.currentRound.winnerNameSnapshot,
            studentId: data.currentRound.winnerStudentId || '',
            latencyMs: data.currentRound.winnerLatencyMs,
          });
        }
      } catch (err) {
        console.error('Error parsing SSE state:', err);
      }
    });

    // Round opened or started with random question
    es.addEventListener('round_opened', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        setAttempts([]);
        setBuzzStatus('IDLE');
        setBuzzPosition(null);
        setBuzzError(null);
        setLastWinnerInfo(null);
        sound.playRoundOpened();
      } catch (err) {
        console.error('Error parsing round_opened:', err);
      }
    });

    // Authoritative buzz accepted event (1st or 2nd contestant)
    es.addEventListener('round_buzz_accepted', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        setAttempts(data.round.attempts || []);

        const isMe = userId && data.contestant.uid === userId;
        if (isMe) {
          setBuzzPosition(data.position);
          setBuzzStatus(data.position === 1 ? 'ACCEPTED_FIRST' : 'ACCEPTED_SECOND');
          sound.playWinnerChime();
          if (data.position === 1) {
            triggerCelebration();
          }
        } else if (userRole === 'student') {
          // If round has reached 2 contestants and student hasn't buzzed
          if (data.round.contestants?.length >= 2 && !buzzPosition) {
            setBuzzStatus('ROUND_CLOSED');
          }
        }
      } catch (err) {
        console.error('Error parsing round_buzz_accepted:', err);
      }
    });

    // Legacy round_winner event
    es.addEventListener('round_winner', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setLastWinnerInfo({
          name: data.winner.name,
          studentId: data.winner.studentId,
          latencyMs: data.winner.latencyMs,
        });
      } catch (err) {
        console.error('Error parsing round_winner:', err);
      }
    });

    // Round attempts stream
    es.addEventListener('round_attempts_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setAttempts(data.attempts);
      } catch (err) {
        console.error('Error parsing round_attempts_update:', err);
      }
    });

    // Admin evaluated answer
    es.addEventListener('round_evaluation_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);

        const isMe = userId && data.evaluatedContestant.uid === userId;
        if (isMe) {
          if (data.result === 'correct') {
            sound.playCorrectAnswer();
            triggerCelebration();
          } else {
            sound.playWrongAnswer();
          }
        }

        // Refresh student score
        fetchMyScore();
      } catch (err) {
        console.error('Error parsing round_evaluation_update:', err);
      }
    });

    // Leaderboard update
    es.addEventListener('leaderboard_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setLeaderboard(data);
      } catch (err) {
        console.error('Error parsing leaderboard_update:', err);
      }
    });

    // Personal score update targeted event
    es.addEventListener('personal_score_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setMyScore(data);
      } catch (err) {
        console.error('Error parsing personal_score_update:', err);
      }
    });

    // Answer revealed by admin
    es.addEventListener('answer_revealed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(prev => (prev ? { ...prev, isAnswerRevealed: true, correctAnswer: data.correctAnswer } : null));
      } catch (err) {
        console.error('Error parsing answer_revealed:', err);
      }
    });

    // Round skipped
    es.addEventListener('round_skipped', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        setBuzzStatus('ROUND_CLOSED');
      } catch (err) {
        console.error('Error parsing round_skipped:', err);
      }
    });

    // Round paused
    es.addEventListener('round_paused', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
      } catch (err) {
        console.error('Error parsing round_paused:', err);
      }
    });

    // Round resumed
    es.addEventListener('round_resumed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
      } catch (err) {
        console.error('Error parsing round_resumed:', err);
      }
    });

    // Round ended
    es.addEventListener('round_ended', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        setBuzzStatus('ROUND_CLOSED');
      } catch (err) {
        console.error('Error parsing round_ended:', err);
      }
    });

    // Round closed (legacy)
    es.addEventListener('round_closed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        if (buzzStatus !== 'ACCEPTED_FIRST' && buzzStatus !== 'ACCEPTED_SECOND' && buzzStatus !== 'WON') {
          setBuzzStatus('ROUND_CLOSED');
        }
      } catch (err) {
        console.error('Error parsing round_closed:', err);
      }
    });

    // Next round ready
    es.addEventListener('round_next_ready', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        setAttempts([]);
        setBuzzStatus('IDLE');
        setBuzzPosition(null);
        setLastWinnerInfo(null);
        setBuzzError(null);
      } catch (err) {
        console.error('Error parsing round_next_ready:', err);
      }
    });

    // Participant update
    es.addEventListener('participant_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setParticipants(data);
      } catch (err) {
        console.error('Error parsing participant_update:', err);
      }
    });

    // Ping
    es.addEventListener('ping', () => {});
  }, [token, sessionId, userRole, userId, buzzPosition, buzzStatus, fetchMyScore, triggerCelebration]);

  useEffect(() => {
    connectSSE();
    fetchMyScore();
    fetchLeaderboard();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectSSE, fetchMyScore, fetchLeaderboard]);

  // Student Buzz Action
  const submitBuzz = async (): Promise<BuzzResponse | null> => {
    if (!token || !sessionId || !currentRound) {
      setBuzzError('No active round to buzz');
      return null;
    }

    const isOpen =
      (currentRound.status === 'OPEN' ||
        currentRound.status === 'QUESTION_ACTIVE' ||
        currentRound.status === 'AWAITING_ANSWER_EVALUATION') &&
      (!currentRound.contestants || currentRound.contestants.length < 2);

    if (!isOpen) {
      setBuzzStatus('ROUND_CLOSED');
      return null;
    }

    if (
      buzzStatus === 'SENDING' ||
      buzzStatus === 'ACCEPTED_FIRST' ||
      buzzStatus === 'ACCEPTED_SECOND' ||
      buzzStatus === 'WON'
    ) {
      return null; // prevent double submit
    }

    setBuzzStatus('SENDING');
    sound.playBuzzPress();

    try {
      const res = await fetch(apiUrl(`/api/sessions/${sessionId}/rounds/${currentRound.roundId}/buzz`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data: BuzzResponse = await res.json();

      if (data.accepted) {
        const pos = data.position || 1;
        setBuzzPosition(pos);
        setBuzzStatus(pos === 1 ? 'ACCEPTED_FIRST' : 'ACCEPTED_SECOND');

        if (data.winner) {
          setLastWinnerInfo({
            name: data.winner.name,
            studentId: data.winner.studentId,
            latencyMs: data.latencyMs || null,
          });
        }
        sound.playWinnerChime();
        if (pos === 1) {
          triggerCelebration();
        }
      } else {
        if (data.reason === 'ALREADY_BUZZED') {
          setBuzzStatus('ALREADY_BUZZED');
          if (data.position) setBuzzPosition(data.position);
        } else if (data.reason === 'TOO_LATE') {
          setBuzzStatus('TOO_LATE');
          if (data.winner) {
            setLastWinnerInfo(data.winner);
          }
          sound.playTooLate();
        } else {
          setBuzzStatus('ROUND_CLOSED');
        }
      }
      return data;
    } catch {
      setBuzzStatus('ERROR');
      setBuzzError('Network error while buzzing. Please check connection.');
      return null;
    }
  };

  // Admin Actions
  const startRandomRound = async () => {
    if (!token || !sessionId) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/start-random`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || 'Failed to start random round');
      }
      const data = await res.json();
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to start random round:', message);
      throw err;
    }
  };

  const evaluateAnswer = async (contestantIndex: 0 | 1, result: 'correct' | 'wrong') => {
    if (!token || !sessionId || !currentRound) return;
    try {
      const res = await fetch(
        apiUrl(`/api/admin/sessions/${sessionId}/rounds/${currentRound.roundId}/evaluate`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ contestantIndex, result }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to evaluate answer');
      }
      return await res.json();
    } catch (err) {
      console.error('Failed to evaluate answer:', err);
      throw err;
    }
  };

  const revealAnswer = async () => {
    if (!token || !sessionId || !currentRound) return;
    try {
      const res = await fetch(
        apiUrl(`/api/admin/sessions/${sessionId}/rounds/${currentRound.roundId}/reveal-answer`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return await res.json();
    } catch (err) {
      console.error('Failed to reveal answer:', err);
    }
  };

  const skipQuestion = async () => {
    if (!token || !sessionId || !currentRound) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/${currentRound.roundId}/skip`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to skip question:', err);
    }
  };

  const pauseRound = async () => {
    if (!token || !sessionId || !currentRound) return;
    try {
      await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/${currentRound.roundId}/pause`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Failed to pause round:', err);
    }
  };

  const resumeRound = async () => {
    if (!token || !sessionId || !currentRound) return;
    try {
      await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/${currentRound.roundId}/resume`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Failed to resume round:', err);
    }
  };

  const endRound = async () => {
    if (!token || !sessionId || !currentRound) return;
    try {
      await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/${currentRound.roundId}/end`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Failed to end round:', err);
    }
  };

  const openRound = async (questionText?: string, roundNumber?: number) => {
    if (!token || !sessionId) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/open`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionText, roundNumber }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to open round');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to open round:', message);
      throw err;
    }
  };

  const closeRound = async () => {
    if (!token || !sessionId || !currentRound) return;
    try {
      await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/${currentRound.roundId}/close`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Failed to close round:', err);
    }
  };

  const nextRound = async (questionText?: string) => {
    if (!token || !sessionId) return;
    try {
      await fetch(apiUrl(`/api/admin/sessions/${sessionId}/rounds/next`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionText }),
      });
    } catch (err) {
      console.error('Failed to prepare next round:', err);
    }
  };

  // Derive active contestants
  const contestants: Contestant[] = currentRound?.contestants || [];
  const activeContestant: Contestant | null =
    currentRound &&
    currentRound.activeContestantIndex >= 0 &&
    currentRound.activeContestantIndex < contestants.length
      ? contestants[currentRound.activeContestantIndex]
      : null;

  return {
    session,
    currentRound,
    participants,
    attempts,
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
    openRound,
    closeRound,
    nextRound,
    startRandomRound,
    evaluateAnswer,
    revealAnswer,
    skipQuestion,
    pauseRound,
    resumeRound,
    endRound,
    fetchMyScore,
    fetchLeaderboard,
    refreshConnection: connectSSE,
  };
}
