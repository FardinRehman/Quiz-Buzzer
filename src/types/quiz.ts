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

export type QuizRoundStatus =
  | 'WAITING_TO_START'
  | 'QUESTION_ACTIVE'
  | 'BUZZER_LOCKED'
  | 'AWAITING_ANSWER_EVALUATION'
  | 'ANSWER_CORRECT'
  | 'ANSWER_INCORRECT'
  | 'NEXT_CONTESTANT'
  | 'QUESTION_COMPLETED'
  | 'ROUND_COMPLETED';

// Keep RoundStatus compatible with both legacy and new statuses
export type RoundStatus = QuizRoundStatus | 'IDLE' | 'OPEN' | 'WINNER_LOCKED' | 'CLOSED';

export interface Contestant {
  uid: string;
  studentId: string;
  displayName: string;
  position: 1 | 2; // 1 = first contestant, 2 = second contestant
  buzzedAt: number;
  latencyMs: number;
  evaluation?: 'correct' | 'wrong' | 'pending';
  pointsAwarded?: number; // 1000 for 1st, 700 for 2nd, 0 for wrong
  evaluatedAt?: number;
}

export type BuzzAttemptStatus =
  | 'ACCEPTED_FIRST'
  | 'ACCEPTED_SECOND'
  | 'ACCEPTED_WINNER'
  | 'REJECTED_TOO_LATE'
  | 'REJECTED_ROUND_CLOSED'
  | 'REJECTED_INELIGIBLE'
  | 'REJECTED_ALREADY_BUZZED';

export interface BuzzAttempt {
  uid: string;
  studentId: string;
  displayName: string;
  submittedAt: number;
  status: BuzzAttemptStatus;
  latencyMs: number;
  position?: 1 | 2 | null;
}

export interface QuestionBankItem {
  id: string;
  question: string;
  correctAnswer: string; // Protected: only returned to admin or after reveal
  importedAt: string;
  usedInRoundId?: string | null;
}

export interface Round {
  roundId: string;
  roundNumber: number;
  questionId?: string | null;
  questionText?: string;
  correctAnswer?: string; // Admin-only: stripped for student clients until revealed
  isAnswerRevealed?: boolean;
  status: RoundStatus;
  contestants: Contestant[];
  activeContestantIndex: number; // 0 for 1st contestant, 1 for 2nd contestant, -1 for none
  roundOpenedAt: number | null;
  roundClosedAt: number | null;
  attempts: BuzzAttempt[];
  // Legacy compatibility fields
  winnerUid?: string | null;
  winnerStudentId?: string | null;
  winnerNameSnapshot?: string | null;
  winnerAcceptedAt?: number | null;
  winnerLatencyMs?: number | null;
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
  position?: 1 | 2;
  reason?: 'FIRST_CONTESTANT' | 'SECOND_CONTESTANT' | 'WINNER' | 'TOO_LATE' | 'ROUND_NOT_OPEN' | 'ALREADY_BUZZED' | 'INELIGIBLE';
  latencyMs?: number;
  contestants?: Contestant[];
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

export interface ScoreLedgerEntry {
  entryId: string;
  sessionId: string;
  roundId: string;
  questionId?: string;
  uid: string;
  studentId: string;
  displayName: string;
  position: 1 | 2;
  points: number;
  timestamp: number;
  reason: 'FIRST_CONTESTANT_CORRECT' | 'SECOND_CONTESTANT_CORRECT' | 'INCORRECT' | 'SKIPPED';
}

export interface StudentActivityItem {
  questionId?: string;
  questionText: string;
  roundNumber: number;
  position: 1 | 2 | null;
  points: number;
  result: 'correct' | 'wrong' | 'no_attempt';
  timestamp: number;
}

export interface StudentScoreSummary {
  uid: string;
  displayName: string;
  studentId: string;
  totalCrypto: number;
  correctAnswersCount: number;
  firstBuzzerWins: number;
  secondBuzzerWins: number;
  lastAwardedAt: number;
  recentActivity: StudentActivityItem[];
}

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string;
  studentId: string;
  totalCrypto: number;
  correctAnswersCount: number;
  firstBuzzerWins: number;
  secondBuzzerWins: number;
  lastAwardedAt: number;
}

