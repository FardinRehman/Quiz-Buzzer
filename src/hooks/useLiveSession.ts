import { useState, useEffect, useRef, useCallback } from 'react';
import type { QuizSession, Round, Participant, BuzzAttempt, BuzzResponse } from '../types/quiz.js';
import { sound } from '../utils/audio.js';
import confetti from 'canvas-confetti';
import { apiUrl } from '../utils/api.js';

interface UseLiveSessionProps {
  token: string | null;
  sessionId: string | null;
  userRole?: 'admin' | 'student';
  userId?: string;
}

export function useLiveSession({ token, sessionId, userRole, userId }: UseLiveSessionProps) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [attempts, setAttempts] = useState<BuzzAttempt[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [buzzStatus, setBuzzStatus] = useState<
    'IDLE' | 'SENDING' | 'WON' | 'TOO_LATE' | 'ROUND_CLOSED' | 'ERROR'
  >('IDLE');
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
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#10b981', '#8b5cf6', '#fbbf24'],
      });
    } catch {
      // ignore
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (!token || !sessionId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = apiUrl(`/api/live/stream?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`);
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

      // Retry connection after 3 seconds
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

    // Round opened
    es.addEventListener('round_opened', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        setAttempts([]);
        setBuzzStatus('IDLE');
        setBuzzError(null);
        setLastWinnerInfo(null);
        sound.playRoundOpened();
      } catch (err) {
        console.error('Error parsing round_opened:', err);
      }
    });

    // Round winner accepted
    es.addEventListener('round_winner', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        setAttempts(data.round.attempts || []);

        const isMe = userId && data.winner.uid === userId;
        setLastWinnerInfo({
          name: data.winner.name,
          studentId: data.winner.studentId,
          latencyMs: data.winner.latencyMs,
        });

        if (isMe) {
          setBuzzStatus('WON');
          sound.playWinnerChime();
          triggerCelebration();
        } else if (userRole === 'student') {
          setBuzzStatus('TOO_LATE');
          sound.playTooLate();
        } else {
          // Admin sound feedback
          sound.playWinnerChime();
        }
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

    // Round closed
    es.addEventListener('round_closed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentRound(data.round);
        if (buzzStatus !== 'WON') {
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
    es.addEventListener('ping', () => {
      // alive
    });
  }, [token, sessionId, userRole, userId, buzzStatus, triggerCelebration]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectSSE]);

  // Student Buzz Action
  const submitBuzz = async (): Promise<BuzzResponse | null> => {
    if (!token || !sessionId || !currentRound) {
      setBuzzError('No active round to buzz');
      return null;
    }

    if (currentRound.status !== 'OPEN') {
      setBuzzStatus('ROUND_CLOSED');
      return null;
    }

    if (buzzStatus === 'SENDING' || buzzStatus === 'WON') {
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
        setBuzzStatus('WON');
        if (data.winner) {
          setLastWinnerInfo({
            name: data.winner.name,
            studentId: data.winner.studentId,
            latencyMs: data.latencyMs || null,
          });
        }
        sound.playWinnerChime();
        triggerCelebration();
      } else {
        if (data.reason === 'TOO_LATE') {
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

  return {
    session,
    currentRound,
    participants,
    attempts,
    isConnected,
    isReconnecting,
    buzzStatus,
    buzzError,
    lastWinnerInfo,
    submitBuzz,
    openRound,
    closeRound,
    nextRound,
    refreshConnection: connectSSE,
  };
}
