export type UserRole = 'admin' | 'student';
export type AccountStatus = 'active' | 'disabled';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  studentId?: string; // USN or College Roll No
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
}

export type RoundStatus = 'IDLE' | 'OPEN' | 'WINNER_LOCKED' | 'CLOSED';

export interface BuzzAttempt {
  uid: string;
  studentId: string;
  displayName: string;
  submittedAt: number;
  status: 'ACCEPTED_WINNER' | 'REJECTED_TOO_LATE' | 'REJECTED_ROUND_CLOSED' | 'REJECTED_INELIGIBLE';
  latencyMs: number;
}

export interface Round {
  roundId: string;
  roundNumber: number;
  questionText?: string;
  status: RoundStatus;
  winnerUid: string | null;
  winnerStudentId: string | null;
  winnerNameSnapshot: string | null;
  winnerAcceptedAt: number | null;
  winnerLatencyMs: number | null;
  roundOpenedAt: number | null;
  roundClosedAt: number | null;
  attempts: BuzzAttempt[];
}

export interface Participant {
  uid: string;
  displayName: string;
  studentId: string;
  joinedAt: string;
  lastSeen: number;
  isConnected: boolean;
}

export interface QuizSession {
  sessionId: string;
  title: string;
  sessionCode: string;
  status: 'waiting' | 'active' | 'completed';
  createdAt: string;
  createdBy: string;
  currentRoundId: string | null;
  rounds: Record<string, Round>;
  participants: Record<string, Participant>;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface BuzzResponse {
  accepted: boolean;
  reason?: 'WINNER' | 'TOO_LATE' | 'ROUND_NOT_OPEN' | 'INELIGIBLE';
  latencyMs?: number;
  winner?: {
    name: string;
    studentId: string;
    latencyMs: number | null;
  };
}

export interface LiveStatePayload {
  session: QuizSession;
  currentRound: Round | null;
  connectedCount: number;
  serverTime: number;
}
