import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateAndParseQuestionsCSV } from './src/utils/csv.js';
import type {
  UserProfile,
  QuizSession,
  Round,
  BuzzAttempt,
  BuzzResponse,
  QuestionBankItem,
  StudentScoreSummary,
  ScoreLedgerEntry,
  LeaderboardEntry,
  Contestant,
} from './src/types/quiz.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SECONDARY_PORT = Number(process.env.SECONDARY_PORT) || 3001;
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'quickbuzz-db.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS for Vercel and cross-origin frontend clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Authoritative Store with disk persistence
interface DatabaseSchema {
  users: Record<string, UserProfile & { passwordHash: string; salt: string }>;
  sessions: Record<string, QuizSession>;
  authTokens: Record<string, string>; // token -> uid
  questionBank: Record<string, QuestionBankItem>; // id -> question and protected correctAnswer
  studentScores: Record<string, StudentScoreSummary>; // uid -> private score and activity
  scoreLedger: Record<string, ScoreLedgerEntry>; // entryId -> audit log
  publicLeaderboard: Record<string, LeaderboardEntry>; // uid -> public ranking
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getInitialDatabase(): DatabaseSchema {
  const adminSalt = crypto.randomBytes(16).toString('hex');

  const adminUid = 'admin_root_1';
  const initialUsers: DatabaseSchema['users'] = {
    [adminUid]: {
      uid: adminUid,
      email: 'fardinrit@gmail.com',
      displayName: 'Quizmaster Admin',
      role: 'admin',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      salt: adminSalt,
      passwordHash: hashPassword('Fardin@RIT07', adminSalt),
    },
  };

  const initialSessionId = 'ses_main_2026';
  const initialRoundId = 'rnd_q1';

  const initialSessions: DatabaseSchema['sessions'] = {
    [initialSessionId]: {
      sessionId: initialSessionId,
      title: 'Inter-College Tech Symposium — Fastest Finger First',
      sessionCode: 'BUZZ99',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: adminUid,
      currentRoundId: initialRoundId,
      rounds: {
        [initialRoundId]: {
          roundId: initialRoundId,
          roundNumber: 1,
          questionId: 'q_seed_1',
          questionText: 'Which computer scientist is widely considered the father of theoretical computer science and artificial intelligence?',
          correctAnswer: 'Alan Turing',
          isAnswerRevealed: false,
          status: 'IDLE',
          contestants: [],
          activeContestantIndex: -1,
          winnerUid: null,
          winnerStudentId: null,
          winnerNameSnapshot: null,
          winnerAcceptedAt: null,
          winnerLatencyMs: null,
          roundOpenedAt: null,
          roundClosedAt: null,
          attempts: [],
        },
      },
      participants: {},
    },
  };

  const initialQuestionBank: DatabaseSchema['questionBank'] = {
    q_seed_1: {
      id: 'q_seed_1',
      question: 'Which computer scientist is widely considered the father of theoretical computer science and artificial intelligence?',
      correctAnswer: 'Alan Turing',
      importedAt: new Date().toISOString(),
      usedInRoundId: null,
    },
    q_seed_2: {
      id: 'q_seed_2',
      question: 'What is the capital of Karnataka?',
      correctAnswer: 'Bengaluru',
      importedAt: new Date().toISOString(),
      usedInRoundId: null,
    },
    q_seed_3: {
      id: 'q_seed_3',
      question: 'Which language is used to build React applications?',
      correctAnswer: 'JavaScript',
      importedAt: new Date().toISOString(),
      usedInRoundId: null,
    },
    q_seed_4: {
      id: 'q_seed_4',
      question: 'What does CPU stand for?',
      correctAnswer: 'Central Processing Unit',
      importedAt: new Date().toISOString(),
      usedInRoundId: null,
    },
    q_seed_5: {
      id: 'q_seed_5',
      question: 'Which protocol provides secure web communication?',
      correctAnswer: 'HTTPS',
      importedAt: new Date().toISOString(),
      usedInRoundId: null,
    },
  };

  return {
    users: initialUsers,
    sessions: initialSessions,
    authTokens: {},
    questionBank: initialQuestionBank,
    studentScores: {},
    scoreLedger: {},
    publicLeaderboard: {},
  };
}

let db: DatabaseSchema;
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(raw);
    if (!db.users || !db.sessions) {
      db = getInitialDatabase();
    }
  } catch {
    db = getInitialDatabase();
  }
} else {
  db = getInitialDatabase();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Ensure all new collections exist in loaded db
if (!db.questionBank || Object.keys(db.questionBank).length === 0) {
  db.questionBank = getInitialDatabase().questionBank;
}
if (!db.studentScores) db.studentScores = {};
if (!db.scoreLedger) db.scoreLedger = {};
if (!db.publicLeaderboard) db.publicLeaderboard = {};

// Ensure root admin always has the specified credentials
const adminUser = Object.values(db.users).find(u => u.role === 'admin') || db.users['admin_root_1'];
if (adminUser) {
  const adminSalt = crypto.randomBytes(16).toString('hex');
  adminUser.email = 'fardinrit@gmail.com';
  adminUser.salt = adminSalt;
  adminUser.passwordHash = hashPassword('Fardin@RIT07', adminSalt);
  persistDb();
}

function persistDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

// Deterministic Leaderboard Ranking
function recomputeLeaderboardRanks(): LeaderboardEntry[] {
  const entries = Object.values(db.publicLeaderboard);
  // Sort descending by totalCrypto, tie-break by earliest lastAwardedAt timestamp, then correct count
  entries.sort((a, b) => {
    if (b.totalCrypto !== a.totalCrypto) {
      return b.totalCrypto - a.totalCrypto;
    }
    if (a.lastAwardedAt !== b.lastAwardedAt) {
      return a.lastAwardedAt - b.lastAwardedAt; // earlier timestamp wins tie
    }
    if (b.correctAnswersCount !== a.correctAnswersCount) {
      return b.correctAnswersCount - a.correctAnswersCount;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  entries.forEach((e, idx) => {
    e.rank = idx + 1;
    db.publicLeaderboard[e.uid] = e;
  });

  return entries;
}

function getLeaderboardList(): LeaderboardEntry[] {
  return recomputeLeaderboardRanks();
}

// Sanitization: Strip protected correctAnswer for student clients
function sanitizeRoundForClient(round: Round | null | undefined, isAdmin: boolean): Round | null {
  if (!round) return null;
  if (isAdmin || round.isAnswerRevealed) {
    return round;
  }
  const { correctAnswer: _, ...safeRound } = round;
  return safeRound as Round;
}

function sanitizeSessionForClient(session: QuizSession | null | undefined, isAdmin: boolean): QuizSession | null {
  if (!session) return null;
  if (isAdmin) return session;

  const sanitizedRounds: Record<string, Round> = {};
  for (const [rId, r] of Object.entries(session.rounds)) {
    sanitizedRounds[rId] = sanitizeRoundForClient(r, false)!;
  }
  return {
    ...session,
    rounds: sanitizedRounds,
  };
}

// SSE Clients for Real-time push
interface SSEClient {
  id: string;
  res: Response;
  sessionId: string;
  uid: string;
  role: 'admin' | 'student';
}

const sseClients = new Map<string, SSEClient>();

function broadcastToSession(sessionId: string, eventName: string, data: unknown) {
  for (const client of sseClients.values()) {
    if (client.sessionId === sessionId) {
      try {
        let payloadData = data;
        // Strip sensitive correct answers from student SSE broadcasts
        if (client.role !== 'admin' && typeof data === 'object' && data !== null) {
          const d = data as Record<string, unknown>;
          if (d.round) {
            payloadData = {
              ...d,
              round: sanitizeRoundForClient(d.round as Round, false),
            };
          } else if (d.session) {
            payloadData = {
              ...d,
              session: sanitizeSessionForClient(d.session as QuizSession, false),
              currentRound: sanitizeRoundForClient(d.currentRound as Round, false),
            };
          }
        }
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(payloadData)}\n\n`;
        client.res.write(payload);
      } catch {
        sseClients.delete(client.id);
      }
    }
  }
}

function broadcastToUser(uid: string, eventName: string, data: unknown) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients.values()) {
    if (client.uid === uid) {
      try {
        client.res.write(payload);
      } catch {
        sseClients.delete(client.id);
      }
    }
  }
}

// Heartbeat interval for SSE
setInterval(() => {
  const ping = `event: ping\ndata: {"time":${Date.now()}}\n\n`;
  for (const [id, client] of sseClients.entries()) {
    try {
      client.res.write(ping);
    } catch {
      sseClients.delete(id);
    }
  }
}, 15000);

// Middleware: Authenticate Bearer Token
function authMiddleware(req: Request & { user?: UserProfile }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token as string);

  if (!token || !db.authTokens[token]) {
    res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
    return;
  }

  const uid = db.authTokens[token];
  const user = db.users[uid];
  if (!user) {
    res.status(401).json({ error: 'Invalid token: User record not found.' });
    return;
  }

  if (user.accountStatus === 'disabled') {
    res.status(403).json({ error: 'Account has been disabled by the administrator.' });
    return;
  }

  req.user = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    studentId: user.studentId,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
  };
  next();
}

function adminOnly(req: Request & { user?: UserProfile }, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    return;
  }
  next();
}

function studentOnly(req: Request & { user?: UserProfile }, res: Response, next: NextFunction) {
  if (req.user?.role !== 'student') {
    res.status(403).json({ error: 'Forbidden: Student privileges required.' });
    return;
  }
  next();
}

/* ==========================================================================
   AUTHENTICATION ROUTES
   ========================================================================== */

// Login
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    res.status(400).json({ error: 'Identifier (email or Student ID) and password are required.' });
    return;
  }

  const cleanIdentifier = String(identifier).trim().toLowerCase();
  const userRecord = Object.values(db.users).find(
    u => u.email.toLowerCase() === cleanIdentifier || (u.studentId && u.studentId.toLowerCase() === cleanIdentifier)
  );

  if (!userRecord) {
    res.status(401).json({ error: 'Invalid credentials. User not found.' });
    return;
  }

  if (userRecord.accountStatus === 'disabled') {
    res.status(403).json({ error: 'Your account has been disabled. Please contact the quiz administrator.' });
    return;
  }

  const computedHash = hashPassword(String(password), userRecord.salt);
  if (computedHash !== userRecord.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    return;
  }

  const token = generateToken();
  db.authTokens[token] = userRecord.uid;
  persistDb();

  const userProfile: UserProfile = {
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: userRecord.displayName,
    studentId: userRecord.studentId,
    role: userRecord.role,
    accountStatus: userRecord.accountStatus,
    createdAt: userRecord.createdAt,
  };

  res.json({ token, user: userProfile });
});

// Current User Profile
app.get('/api/auth/me', authMiddleware, (req: Request & { user?: UserProfile }, res: Response) => {
  res.json({ user: req.user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.body.token as string);
  if (token && db.authTokens[token]) {
    delete db.authTokens[token];
    persistDb();
  }
  res.json({ success: true });
});

// Student Quick Join with Name and Session PIN (No password or account registration needed!)
app.post('/api/sessions/quick-join', (req, res) => {
  const { name, sessionPin, studentId } = req.body;
  if (!name || !sessionPin) {
    res.status(400).json({ error: 'Contestant Name and Session PIN are required.' });
    return;
  }

  const cleanPin = String(sessionPin).trim().toUpperCase();
  const session = Object.values(db.sessions).find(s => s.sessionCode.toUpperCase() === cleanPin);

  if (!session) {
    res.status(404).json({ error: `Invalid Session PIN "${cleanPin}". Please check the PIN displayed on the host screen.` });
    return;
  }

  if (session.status === 'completed') {
    res.status(400).json({ error: 'This quiz session has already concluded.' });
    return;
  }

  const cleanName = String(name).trim();
  const cleanStudentId = studentId && String(studentId).trim().length > 0
    ? String(studentId).trim().toUpperCase()
    : `STU-${Math.floor(100 + Math.random() * 900)}`;

  const uid = `stu_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');

  const studentUser = {
    uid,
    email: `${uid}@quickbuzz.local`,
    displayName: cleanName,
    studentId: cleanStudentId,
    role: 'student' as const,
    accountStatus: 'active' as const,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: '',
  };

  db.users[uid] = studentUser;

  // Add participant to session
  session.participants[uid] = {
    uid,
    displayName: cleanName,
    studentId: cleanStudentId,
    joinedAt: new Date().toISOString(),
    lastSeen: Date.now(),
    isConnected: true,
  };

  const token = generateToken();
  db.authTokens[token] = uid;
  persistDb();

  // Notify active session subscribers of new participant
  broadcastToSession(session.sessionId, 'participant_update', session.participants);

  res.status(200).json({
    token,
    user: {
      uid: studentUser.uid,
      displayName: studentUser.displayName,
      studentId: studentUser.studentId,
      role: studentUser.role,
      accountStatus: studentUser.accountStatus,
      email: studentUser.email,
      createdAt: studentUser.createdAt,
    },
    session: {
      sessionId: session.sessionId,
      title: session.title,
      sessionCode: session.sessionCode,
      status: session.status,
      currentRoundId: session.currentRoundId,
    },
  });
});

/* ==========================================================================
   REAL-TIME SSE STREAM
   ========================================================================== */

app.get('/api/live/stream', (req, res) => {
  const token = req.query.token as string;
  const sessionId = req.query.sessionId as string;

  if (!token || !db.authTokens[token]) {
    res.status(401).send('Unauthorized');
    return;
  }

  const uid = db.authTokens[token];
  const user = db.users[uid];
  if (!user || user.accountStatus === 'disabled') {
    res.status(403).send('Forbidden');
    return;
  }

  const session = db.sessions[sessionId];
  if (!session) {
    res.status(404).send('Session not found');
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const sseClient: SSEClient = {
    id: clientId,
    res,
    sessionId,
    uid,
    role: user.role,
  };

  sseClients.set(clientId, sseClient);

  // Mark participant as connected
  if (user.role === 'student') {
    if (!session.participants[uid]) {
      session.participants[uid] = {
        uid: user.uid,
        displayName: user.displayName,
        studentId: user.studentId || 'N/A',
        joinedAt: new Date().toISOString(),
        lastSeen: Date.now(),
        isConnected: true,
      };
    } else {
      session.participants[uid].isConnected = true;
      session.participants[uid].lastSeen = Date.now();
    }
    persistDb();
    broadcastToSession(sessionId, 'participant_update', session.participants);
  }

  // Send initial state snapshot immediately (sanitized so students never receive protected answers)
  const isAdmin = user.role === 'admin';
  const initialPayload = {
    session: sanitizeSessionForClient(session, isAdmin),
    currentRound: sanitizeRoundForClient(
      session.currentRoundId ? session.rounds[session.currentRoundId] : null,
      isAdmin
    ),
    leaderboard: getLeaderboardList(),
    serverTime: Date.now(),
  };
  res.write(`event: state\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  req.on('close', () => {
    sseClients.delete(clientId);
    if (user.role === 'student' && session.participants[uid]) {
      // Check if user has other active connections
      const otherConnections = Array.from(sseClients.values()).some(
        c => c.uid === uid && c.sessionId === sessionId
      );
      if (!otherConnections) {
        session.participants[uid].isConnected = false;
        persistDb();
        broadcastToSession(sessionId, 'participant_update', session.participants);
      }
    }
  });
});

/* ==========================================================================
   ATOMIC BUZZER LOGIC (RACE-SAFE GUARANTEE)
   ========================================================================== */

// Mutex lock to strictly serialize buzz transactions per round
const roundLocks = new Map<string, Promise<unknown>>();

async function runInRoundLock<T>(roundId: string, task: () => Promise<T> | T): Promise<T> {
  const prevLock = roundLocks.get(roundId) || Promise.resolve();
  let release: () => void;
  const newLock = new Promise<void>(resolve => {
    release = resolve;
  });
  roundLocks.set(roundId, newLock);

  try {
    await prevLock;
    return await task();
  } finally {
    release!();
    if (roundLocks.get(roundId) === newLock) {
      roundLocks.delete(roundId);
    }
  }
}

app.post(
  '/api/sessions/:sessionId/rounds/:roundId/buzz',
  authMiddleware,
  studentOnly,
  async (req: Request & { user?: UserProfile }, res: Response) => {
    const { sessionId, roundId } = req.params;
    const student = req.user!;
    const now = Date.now();

    const result = await runInRoundLock(roundId, () => {
      const session = db.sessions[sessionId];
      if (!session) {
        return { statusCode: 404, payload: { error: 'Session not found' } };
      }

      if (session.status !== 'active') {
        return { statusCode: 400, payload: { error: 'Session is not active', reason: 'INELIGIBLE' } };
      }

      const round = session.rounds[roundId];
      if (!round) {
        return { statusCode: 404, payload: { error: 'Round not found', reason: 'ROUND_NOT_OPEN' } };
      }

      if (!round.contestants) round.contestants = [];

      // 1. Prevent duplicate submissions from the same student for the same question
      const alreadyBuzzed = round.attempts.some(a => a.uid === student.uid);
      if (alreadyBuzzed) {
        const existingContestant = round.contestants.find(c => c.uid === student.uid);
        return {
          statusCode: 200,
          payload: {
            accepted: false,
            reason: 'ALREADY_BUZZED',
            position: existingContestant?.position || null,
            latencyMs: 0,
            contestants: round.contestants,
          },
        };
      }

      // 2. Reject buzzes submitted before activation, after buzzer closes, or after max 2 contestants accepted
      const isAccepting =
        (round.status === 'OPEN' ||
          round.status === 'QUESTION_ACTIVE' ||
          round.status === 'AWAITING_ANSWER_EVALUATION') &&
        round.contestants.length < 2;

      if (!isAccepting) {
        const latencyMs = round.roundOpenedAt ? Math.max(1, now - round.roundOpenedAt) : 0;
        const attempt: BuzzAttempt = {
          uid: student.uid,
          studentId: student.studentId || 'N/A',
          displayName: student.displayName,
          submittedAt: now,
          status: round.contestants.length >= 2 ? 'REJECTED_TOO_LATE' : 'REJECTED_ROUND_CLOSED',
          latencyMs,
          position: null,
        };
        round.attempts.push(attempt);
        persistDb();

        broadcastToSession(sessionId, 'round_attempts_update', {
          roundId,
          attempts: round.attempts,
        });

        const response: BuzzResponse = {
          accepted: false,
          reason: round.contestants.length >= 2 ? 'TOO_LATE' : 'ROUND_NOT_OPEN',
          latencyMs,
          contestants: round.contestants,
          winner: {
            name: round.contestants[0]?.displayName || round.winnerNameSnapshot || 'Another Contestant',
            studentId: round.contestants[0]?.studentId || round.winnerStudentId || 'N/A',
            latencyMs: round.contestants[0]?.latencyMs ?? round.winnerLatencyMs,
          },
        };
        return { statusCode: 200, payload: response };
      }

      const latencyMs = round.roundOpenedAt ? Math.max(1, now - round.roundOpenedAt) : 0;

      // Authoritative First Contestant
      if (round.contestants.length === 0) {
        const contestant1: Contestant = {
          uid: student.uid,
          studentId: student.studentId || 'N/A',
          displayName: student.displayName,
          position: 1,
          buzzedAt: now,
          latencyMs,
          evaluation: 'pending',
        };
        round.contestants.push(contestant1);
        round.activeContestantIndex = 0;
        round.status = 'AWAITING_ANSWER_EVALUATION';

        // Legacy compatibility fields
        round.winnerUid = student.uid;
        round.winnerStudentId = student.studentId || 'N/A';
        round.winnerNameSnapshot = student.displayName;
        round.winnerAcceptedAt = now;
        round.winnerLatencyMs = latencyMs;

        const attempt: BuzzAttempt = {
          uid: student.uid,
          studentId: student.studentId || 'N/A',
          displayName: student.displayName,
          submittedAt: now,
          status: 'ACCEPTED_FIRST',
          latencyMs,
          position: 1,
        };
        round.attempts.push(attempt);
        persistDb();

        // Broadcast to session
        broadcastToSession(sessionId, 'round_buzz_accepted', {
          roundId,
          round,
          contestant: contestant1,
          position: 1,
        });

        // Legacy event for backward-compatibility with existing hooks
        broadcastToSession(sessionId, 'round_winner', {
          roundId,
          round,
          winner: {
            uid: student.uid,
            name: student.displayName,
            studentId: student.studentId,
            acceptedAt: now,
            latencyMs,
          },
        });

        const response: BuzzResponse = {
          accepted: true,
          position: 1,
          reason: 'FIRST_CONTESTANT',
          latencyMs,
          contestants: round.contestants,
          winner: {
            name: student.displayName,
            studentId: student.studentId || 'N/A',
            latencyMs,
          },
        };
        return { statusCode: 200, payload: response };
      }

      // Authoritative Second Contestant
      if (round.contestants.length === 1) {
        const contestant2: Contestant = {
          uid: student.uid,
          studentId: student.studentId || 'N/A',
          displayName: student.displayName,
          position: 2,
          buzzedAt: now,
          latencyMs,
          evaluation: 'pending',
        };
        round.contestants.push(contestant2);

        // Immediately lock further buzzer attempts once 2 contestants are recorded!
        round.status = 'BUZZER_LOCKED';

        const attempt: BuzzAttempt = {
          uid: student.uid,
          studentId: student.studentId || 'N/A',
          displayName: student.displayName,
          submittedAt: now,
          status: 'ACCEPTED_SECOND',
          latencyMs,
          position: 2,
        };
        round.attempts.push(attempt);
        persistDb();

        broadcastToSession(sessionId, 'round_buzz_accepted', {
          roundId,
          round,
          contestant: contestant2,
          position: 2,
        });

        const response: BuzzResponse = {
          accepted: true,
          position: 2,
          reason: 'SECOND_CONTESTANT',
          latencyMs,
          contestants: round.contestants,
          winner: {
            name: round.contestants[0].displayName,
            studentId: round.contestants[0].studentId,
            latencyMs: round.contestants[0].latencyMs,
          },
        };
        return { statusCode: 200, payload: response };
      }

      // 3rd or later attempt rejected as TOO_LATE
      const attempt: BuzzAttempt = {
        uid: student.uid,
        studentId: student.studentId || 'N/A',
        displayName: student.displayName,
        submittedAt: now,
        status: 'REJECTED_TOO_LATE',
        latencyMs,
        position: null,
      };
      round.attempts.push(attempt);
      persistDb();

      broadcastToSession(sessionId, 'round_attempts_update', {
        roundId,
        attempts: round.attempts,
      });

      return {
        statusCode: 200,
        payload: {
          accepted: false,
          reason: 'TOO_LATE',
          latencyMs,
          contestants: round.contestants,
        },
      };
    });

    res.status(result.statusCode).json(result.payload);
  }
);

/* ==========================================================================
   ADMIN ANSWER EVALUATION & CRYPTO SCORING WORKFLOW
   ========================================================================== */

// Admin evaluates answer: Mark Answer Correct (+1000 for 1st, +700 for 2nd) or Wrong (0 pts)
app.post(
  '/api/admin/sessions/:sessionId/rounds/:roundId/evaluate',
  authMiddleware,
  adminOnly,
  async (req, res) => {
    const { sessionId, roundId } = req.params;
    const { contestantIndex, result } = req.body;

    if (contestantIndex !== 0 && contestantIndex !== 1) {
      res.status(400).json({ error: 'contestantIndex must be 0 (first contestant) or 1 (second contestant)' });
      return;
    }

    if (result !== 'correct' && result !== 'wrong') {
      res.status(400).json({ error: 'result must be "correct" or "wrong"' });
      return;
    }

    const outcome = await runInRoundLock(roundId, () => {
      const session = db.sessions[sessionId];
      if (!session) return { statusCode: 404, payload: { error: 'Session not found' } };
      const round = session.rounds[roundId];
      if (!round) return { statusCode: 404, payload: { error: 'Round not found' } };

      if (!round.contestants || !round.contestants[contestantIndex]) {
        return { statusCode: 400, payload: { error: `No contestant found at position ${contestantIndex + 1}` } };
      }

      const contestant = round.contestants[contestantIndex];

      // Idempotency: Prevent duplicate evaluation on double clicks or page refresh
      if (contestant.evaluation && contestant.evaluation !== 'pending') {
        return {
          statusCode: 200,
          payload: {
            success: true,
            alreadyEvaluated: true,
            round,
            evaluatedContestant: contestant,
            pointsAwarded: contestant.pointsAwarded || 0,
          },
        };
      }

      const now = Date.now();
      contestant.evaluatedAt = now;
      contestant.evaluation = result;

      // Crypto Scoring Rules:
      // First contestant correct: 1,000 Crypto
      // Second contestant correct: 700 Crypto
      // Wrong answer: 0 Crypto
      const points = result === 'correct' ? (contestant.position === 1 ? 1000 : 700) : 0;
      contestant.pointsAwarded = points;

      const uid = contestant.uid;
      if (!db.studentScores[uid]) {
        db.studentScores[uid] = {
          uid,
          displayName: contestant.displayName,
          studentId: contestant.studentId,
          totalCrypto: 0,
          correctAnswersCount: 0,
          firstBuzzerWins: 0,
          secondBuzzerWins: 0,
          lastAwardedAt: now,
          recentActivity: [],
        };
      }

      const studentScore = db.studentScores[uid];
      studentScore.displayName = contestant.displayName;
      studentScore.studentId = contestant.studentId;

      if (result === 'correct') {
        studentScore.totalCrypto += points;
        studentScore.correctAnswersCount += 1;
        if (contestant.position === 1) {
          studentScore.firstBuzzerWins += 1;
        } else {
          studentScore.secondBuzzerWins += 1;
        }
        studentScore.lastAwardedAt = now;
      }

      // Add to student's private personal activity history
      studentScore.recentActivity.unshift({
        questionId: round.questionId || roundId,
        questionText: round.questionText || '',
        roundNumber: round.roundNumber,
        position: contestant.position,
        points,
        result,
        timestamp: now,
      });

      if (studentScore.recentActivity.length > 50) {
        studentScore.recentActivity = studentScore.recentActivity.slice(0, 50);
      }

      // Audit Ledger Record
      const entryId = `ledger_${now}_${crypto.randomBytes(3).toString('hex')}`;
      const reason =
        result === 'correct'
          ? contestant.position === 1
            ? 'FIRST_CONTESTANT_CORRECT'
            : 'SECOND_CONTESTANT_CORRECT'
          : 'INCORRECT';

      db.scoreLedger[entryId] = {
        entryId,
        sessionId,
        roundId,
        questionId: round.questionId || undefined,
        uid,
        studentId: contestant.studentId,
        displayName: contestant.displayName,
        position: contestant.position,
        points,
        timestamp: now,
        reason,
      };

      // Update Public Leaderboard
      db.publicLeaderboard[uid] = {
        rank: 1,
        uid,
        displayName: contestant.displayName,
        studentId: contestant.studentId,
        totalCrypto: studentScore.totalCrypto,
        correctAnswersCount: studentScore.correctAnswersCount,
        firstBuzzerWins: studentScore.firstBuzzerWins,
        secondBuzzerWins: studentScore.secondBuzzerWins,
        lastAwardedAt: studentScore.lastAwardedAt,
      };

      recomputeLeaderboardRanks();

      // State transitions:
      if (contestant.position === 1) {
        if (result === 'correct') {
          round.status = 'ANSWER_CORRECT';
          round.roundClosedAt = now;
          round.winnerUid = contestant.uid;
          round.winnerStudentId = contestant.studentId;
          round.winnerNameSnapshot = contestant.displayName;
        } else {
          // 1st contestant wrong: give 2nd contestant opportunity if one buzzed
          if (round.contestants.length >= 2) {
            round.status = 'NEXT_CONTESTANT';
            round.activeContestantIndex = 1;
          } else {
            // No second contestant registered
            round.status = 'QUESTION_COMPLETED';
            round.roundClosedAt = now;
          }
        }
      } else {
        // 2nd contestant evaluated
        if (result === 'correct') {
          round.status = 'ANSWER_CORRECT';
          round.roundClosedAt = now;
          round.winnerUid = contestant.uid;
          round.winnerStudentId = contestant.studentId;
          round.winnerNameSnapshot = contestant.displayName;
        } else {
          round.status = 'ANSWER_INCORRECT';
          round.roundClosedAt = now;
        }
      }

      persistDb();

      // Broadcast real-time evaluation updates
      broadcastToSession(sessionId, 'round_evaluation_update', {
        roundId,
        round,
        evaluatedContestant: contestant,
        pointsAwarded: points,
        result,
      });

      broadcastToSession(sessionId, 'leaderboard_update', getLeaderboardList());
      broadcastToUser(uid, 'personal_score_update', studentScore);

      return {
        statusCode: 200,
        payload: {
          success: true,
          round,
          evaluatedContestant: contestant,
          pointsAwarded: points,
        },
      };
    });

    res.status(outcome.statusCode).json(outcome.payload);
  }
);

// Admin reveals correct answer to all clients
app.post(
  '/api/admin/sessions/:sessionId/rounds/:roundId/reveal-answer',
  authMiddleware,
  adminOnly,
  (req, res) => {
    const { sessionId, roundId } = req.params;
    const session = db.sessions[sessionId];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const round = session.rounds[roundId];
    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }

    round.isAnswerRevealed = true;
    persistDb();

    broadcastToSession(sessionId, 'answer_revealed', {
      roundId,
      correctAnswer: round.correctAnswer,
    });

    res.json({ success: true, round, correctAnswer: round.correctAnswer });
  }
);

// Admin skips current question
app.post(
  '/api/admin/sessions/:sessionId/rounds/:roundId/skip',
  authMiddleware,
  adminOnly,
  (req, res) => {
    const { sessionId, roundId } = req.params;
    const session = db.sessions[sessionId];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const round = session.rounds[roundId];
    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }

    round.status = 'QUESTION_COMPLETED';
    round.roundClosedAt = Date.now();
    persistDb();

    broadcastToSession(sessionId, 'round_skipped', { roundId, round });
    res.json({ success: true, round });
  }
);

// Admin pauses active round
app.post(
  '/api/admin/sessions/:sessionId/rounds/:roundId/pause',
  authMiddleware,
  adminOnly,
  (req, res) => {
    const { sessionId, roundId } = req.params;
    const session = db.sessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const round = session.rounds[roundId];
    if (!round) return res.status(404).json({ error: 'Round not found' });

    if (round.status === 'QUESTION_ACTIVE' || round.status === 'OPEN') {
      round.status = 'BUZZER_LOCKED';
      persistDb();
      broadcastToSession(sessionId, 'round_paused', { roundId, round });
    }
    res.json({ success: true, round });
  }
);

// Admin resumes paused round
app.post(
  '/api/admin/sessions/:sessionId/rounds/:roundId/resume',
  authMiddleware,
  adminOnly,
  (req, res) => {
    const { sessionId, roundId } = req.params;
    const session = db.sessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const round = session.rounds[roundId];
    if (!round) return res.status(404).json({ error: 'Round not found' });

    if (round.status === 'BUZZER_LOCKED' && round.contestants.length < 2) {
      round.status = 'QUESTION_ACTIVE';
      persistDb();
      broadcastToSession(sessionId, 'round_resumed', { roundId, round });
    }
    res.json({ success: true, round });
  }
);

// Admin ends the round completely
app.post(
  '/api/admin/sessions/:sessionId/rounds/:roundId/end',
  authMiddleware,
  adminOnly,
  (req, res) => {
    const { sessionId, roundId } = req.params;
    const session = db.sessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const round = session.rounds[roundId];
    if (!round) return res.status(404).json({ error: 'Round not found' });

    round.status = 'ROUND_COMPLETED';
    round.roundClosedAt = Date.now();
    persistDb();

    broadcastToSession(sessionId, 'round_ended', { roundId, round });
    res.json({ success: true, round });
  }
);

// Admin selects random question from question bank and starts round
app.post(
  '/api/admin/sessions/:sessionId/rounds/start-random',
  authMiddleware,
  adminOnly,
  (req, res) => {
    const { sessionId } = req.params;
    const session = db.sessions[sessionId];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Filter questions that have not yet been used
    const unusedQuestions = Object.values(db.questionBank).filter(q => !q.usedInRoundId);

    if (unusedQuestions.length === 0) {
      res.status(400).json({
        error: 'NO_QUESTIONS_AVAILABLE',
        message: 'All questions in the Question Bank have been used. Please upload more questions or reset the question sequence.',
        totalQuestions: Object.keys(db.questionBank).length,
      });
      return;
    }

    // Pick one unused question randomly
    const randomIndex = Math.floor(Math.random() * unusedQuestions.length);
    const chosenQuestion = unusedQuestions[randomIndex];

    const nextNumber = Object.keys(session.rounds).length + 1;
    const newRoundId = `rnd_${Date.now()}_${nextNumber}`;

    // Mark question as used
    chosenQuestion.usedInRoundId = newRoundId;

    const newRound: Round = {
      roundId: newRoundId,
      roundNumber: nextNumber,
      questionId: chosenQuestion.id,
      questionText: chosenQuestion.question,
      correctAnswer: chosenQuestion.correctAnswer,
      isAnswerRevealed: false,
      status: 'QUESTION_ACTIVE',
      contestants: [],
      activeContestantIndex: -1,
      roundOpenedAt: Date.now(),
      roundClosedAt: null,
      attempts: [],
      winnerUid: null,
      winnerStudentId: null,
      winnerNameSnapshot: null,
      winnerAcceptedAt: null,
      winnerLatencyMs: null,
    };

    session.rounds[newRoundId] = newRound;
    session.currentRoundId = newRoundId;
    persistDb();

    // Broadcast to all participants (students receive sanitized round with protected correctAnswer stripped)
    broadcastToSession(sessionId, 'round_opened', {
      roundId: newRoundId,
      round: newRound,
    });

    res.status(200).json({
      success: true,
      round: newRound,
      remainingUnusedQuestions: unusedQuestions.length - 1,
    });
  }
);

/* ==========================================================================
   QUESTION BANK MANAGEMENT ROUTES (ADMIN ONLY)
   ========================================================================== */

// Preview CSV before import
app.post('/api/admin/questions/preview-csv', authMiddleware, adminOnly, (req, res) => {
  const { csvContent } = req.body;
  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({ error: 'csvContent string is required' });
    return;
  }

  const parseResult = validateAndParseQuestionsCSV(csvContent);
  res.json({
    valid: parseResult.valid,
    totalDetected: parseResult.totalRows,
    validCount: parseResult.validQuestions.length,
    invalidCount: parseResult.errors.length,
    errors: parseResult.errors,
    preview: parseResult.validQuestions.slice(0, 10), // first 10 for preview
  });
});

// Import CSV questions into authoritative question bank
app.post('/api/admin/questions/import-csv', authMiddleware, adminOnly, (req, res) => {
  const { csvContent } = req.body;
  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({ error: 'csvContent string is required' });
    return;
  }

  const parseResult = validateAndParseQuestionsCSV(csvContent);
  if (parseResult.validQuestions.length === 0) {
    res.status(400).json({
      error: 'No valid questions found to import.',
      errors: parseResult.errors,
    });
    return;
  }

  let importedCount = 0;
  parseResult.validQuestions.forEach((q, idx) => {
    const qId = `q_${Date.now()}_${idx}_${crypto.randomBytes(2).toString('hex')}`;
    db.questionBank[qId] = {
      id: qId,
      question: q.question,
      correctAnswer: q.correctAnswer,
      importedAt: new Date().toISOString(),
      usedInRoundId: null,
    };
    importedCount++;
  });

  persistDb();

  const totalQuestions = Object.keys(db.questionBank).length;
  const availableCount = Object.values(db.questionBank).filter(q => !q.usedInRoundId).length;

  res.status(201).json({
    success: true,
    importedCount,
    totalQuestions,
    availableCount,
    errors: parseResult.errors,
  });
});

// List questions in Question Bank
app.get('/api/admin/questions', authMiddleware, adminOnly, (_req, res) => {
  const questions = Object.values(db.questionBank).reverse();
  const availableCount = questions.filter(q => !q.usedInRoundId).length;
  res.json({
    questions,
    total: questions.length,
    availableCount,
    usedCount: questions.length - availableCount,
  });
});

// Delete single question
app.delete('/api/admin/questions/:questionId', authMiddleware, adminOnly, (req, res) => {
  const { questionId } = req.params;
  if (!db.questionBank[questionId]) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  delete db.questionBank[questionId];
  persistDb();

  res.json({ success: true, remaining: Object.keys(db.questionBank).length });
});

// Clear entire question bank
app.post('/api/admin/questions/clear', authMiddleware, adminOnly, (_req, res) => {
  db.questionBank = {};
  persistDb();
  res.json({ success: true, message: 'Question bank cleared.' });
});

// Reset question sequence (marks all as unused without modifying student scores)
app.post('/api/admin/questions/reset-sequence', authMiddleware, adminOnly, (_req, res) => {
  for (const q of Object.values(db.questionBank)) {
    q.usedInRoundId = null;
  }
  persistDb();
  res.json({
    success: true,
    message: 'Question sequence reset. All questions are now eligible for rounds.',
    availableCount: Object.keys(db.questionBank).length,
  });
});

/* ==========================================================================
   PUBLIC LEADERBOARD & PRIVATE STUDENT SCORE ROUTES
   ========================================================================== */

// Public Leaderboard (Rank, Name, Total Crypto, Correct Answers, 1st Wins, 2nd Wins)
app.get('/api/leaderboard', authMiddleware, (_req, res) => {
  res.json({ leaderboard: getLeaderboardList() });
});

// Student's Private Personal Score & Activity History (Protected by authenticated UID)
app.get('/api/students/me/score', authMiddleware, studentOnly, (req: Request & { user?: UserProfile }, res: Response) => {
  const uid = req.user!.uid;
  let score = db.studentScores[uid];
  if (!score) {
    score = {
      uid,
      displayName: req.user!.displayName,
      studentId: req.user!.studentId || 'N/A',
      totalCrypto: 0,
      correctAnswersCount: 0,
      firstBuzzerWins: 0,
      secondBuzzerWins: 0,
      lastAwardedAt: Date.now(),
      recentActivity: [],
    };
    db.studentScores[uid] = score;
    persistDb();
  }
  res.json({ score });
});

// Admin view of all student scores & audit ledger
app.get('/api/admin/scores', authMiddleware, adminOnly, (_req, res) => {
  res.json({
    studentScores: Object.values(db.studentScores),
    ledger: Object.values(db.scoreLedger).reverse(),
    leaderboard: getLeaderboardList(),
  });
});


/* ==========================================================================
   SESSION & ROUND CONTROL ROUTES
   ========================================================================== */

// Get current session state (sanitized for students)
app.get('/api/sessions/:sessionId', authMiddleware, (req: Request & { user?: UserProfile }, res: Response) => {
  const session = db.sessions[req.params.sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const isAdmin = req.user?.role === 'admin';
  const currentRound = session.currentRoundId ? session.rounds[session.currentRoundId] : null;
  res.json({
    session: sanitizeSessionForClient(session, isAdmin),
    currentRound: sanitizeRoundForClient(currentRound, isAdmin),
    leaderboard: getLeaderboardList(),
  });
});

// Join session by session code
app.post('/api/sessions/join', authMiddleware, (req: Request & { user?: UserProfile }, res: Response) => {
  const { sessionCode } = req.body;
  if (!sessionCode) {
    res.status(400).json({ error: 'Session code is required' });
    return;
  }

  const cleanCode = String(sessionCode).trim().toUpperCase();
  const session = Object.values(db.sessions).find(s => s.sessionCode.toUpperCase() === cleanCode);

  if (!session) {
    res.status(404).json({ error: 'Invalid session code. No active session found.' });
    return;
  }

  const user = req.user!;
  if (user.role === 'student') {
    session.participants[user.uid] = {
      uid: user.uid,
      displayName: user.displayName,
      studentId: user.studentId || 'N/A',
      joinedAt: new Date().toISOString(),
      lastSeen: Date.now(),
      isConnected: true,
    };
    persistDb();
    broadcastToSession(session.sessionId, 'participant_update', session.participants);
  }

  res.json({
    sessionId: session.sessionId,
    title: session.title,
    status: session.status,
    currentRoundId: session.currentRoundId,
  });
});

// List all sessions (Admin)
app.get('/api/admin/sessions', authMiddleware, adminOnly, (_req, res) => {
  const list = Object.values(db.sessions).map(s => ({
    sessionId: s.sessionId,
    title: s.title,
    sessionCode: s.sessionCode,
    status: s.status,
    createdAt: s.createdAt,
    roundCount: Object.keys(s.rounds).length,
    participantCount: Object.keys(s.participants).length,
    currentRoundId: s.currentRoundId,
  }));
  res.json({ sessions: list });
});

// Create new session (Admin)
app.post('/api/admin/sessions', authMiddleware, adminOnly, (req: Request & { user?: UserProfile }, res: Response) => {
  const { title, customCode } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Session title is required' });
    return;
  }

  const sessionId = `ses_${Date.now()}`;
  const sessionCode = customCode ? String(customCode).trim().toUpperCase() : `QB${Math.floor(1000 + Math.random() * 9000)}`;

  // Generate initial round 1
  const round1Id = `rnd_${Date.now()}_1`;
  const newRound: Round = {
    roundId: round1Id,
    roundNumber: 1,
    questionText: '',
    status: 'IDLE',
    contestants: [],
    activeContestantIndex: -1,
    winnerUid: null,
    winnerStudentId: null,
    winnerNameSnapshot: null,
    winnerAcceptedAt: null,
    winnerLatencyMs: null,
    roundOpenedAt: null,
    roundClosedAt: null,
    attempts: [],
  };

  const newSession: QuizSession = {
    sessionId,
    title: String(title).trim(),
    sessionCode,
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: req.user!.uid,
    currentRoundId: round1Id,
    rounds: {
      [round1Id]: newRound,
    },
    participants: {},
  };

  db.sessions[sessionId] = newSession;
  persistDb();

  res.status(201).json({ session: newSession });
});

// Update session status (Admin)
app.patch('/api/admin/sessions/:sessionId/status', authMiddleware, adminOnly, (req, res) => {
  const { sessionId } = req.params;
  const { status } = req.body;
  const session = db.sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (['waiting', 'active', 'completed'].includes(status)) {
    session.status = status;
    persistDb();
    broadcastToSession(sessionId, 'session_status_changed', { status });
    res.json({ success: true, session });
  } else {
    res.status(400).json({ error: 'Invalid status' });
  }
});

// Open Buzzer Round (Admin)
app.post('/api/admin/sessions/:sessionId/rounds/open', authMiddleware, adminOnly, (req, res) => {
  const { sessionId } = req.params;
  const { questionText, roundNumber } = req.body;

  const session = db.sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Create new round or reuse idle round
  const existingRound = session.currentRoundId ? session.rounds[session.currentRoundId] : null;
  let targetRound: Round;

  if (existingRound && existingRound.status === 'IDLE') {
    targetRound = existingRound;
  } else {
    const nextNum = roundNumber ? Number(roundNumber) : Object.keys(session.rounds).length + 1;
    const newRoundId = `rnd_${Date.now()}_${nextNum}`;
    targetRound = {
      roundId: newRoundId,
      roundNumber: nextNum,
      questionText: '',
      status: 'IDLE',
      contestants: [],
      activeContestantIndex: -1,
      winnerUid: null,
      winnerStudentId: null,
      winnerNameSnapshot: null,
      winnerAcceptedAt: null,
      winnerLatencyMs: null,
      roundOpenedAt: null,
      roundClosedAt: null,
      attempts: [],
    };
    session.rounds[newRoundId] = targetRound;
    session.currentRoundId = newRoundId;
  }

  if (questionText !== undefined) {
    targetRound.questionText = String(questionText);
  }

  targetRound.status = 'OPEN';
  targetRound.roundOpenedAt = Date.now();
  targetRound.winnerUid = null;
  targetRound.winnerStudentId = null;
  targetRound.winnerNameSnapshot = null;
  targetRound.winnerAcceptedAt = null;
  targetRound.winnerLatencyMs = null;
  targetRound.roundClosedAt = null;
  targetRound.attempts = [];

  persistDb();

  // Broadcast to all connected students and admin
  broadcastToSession(sessionId, 'round_opened', {
    roundId: targetRound.roundId,
    round: targetRound,
  });

  res.json({ success: true, round: targetRound });
});

// Close Buzzer Round (Admin)
app.post('/api/admin/sessions/:sessionId/rounds/:roundId/close', authMiddleware, adminOnly, (req, res) => {
  const { sessionId, roundId } = req.params;
  const session = db.sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const round = session.rounds[roundId];
  if (!round) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }

  round.status = 'CLOSED';
  round.roundClosedAt = Date.now();
  persistDb();

  broadcastToSession(sessionId, 'round_closed', {
    roundId,
    round,
  });

  res.json({ success: true, round });
});

// Reset Round or Prepare Next Question (Admin)
app.post('/api/admin/sessions/:sessionId/rounds/next', authMiddleware, adminOnly, (req, res) => {
  const { sessionId } = req.params;
  const { questionText } = req.body;

  const session = db.sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const nextNumber = Object.keys(session.rounds).length + 1;
  const newRoundId = `rnd_${Date.now()}_${nextNumber}`;

  const newRound: Round = {
    roundId: newRoundId,
    roundNumber: nextNumber,
    questionText: questionText ? String(questionText) : '',
    status: 'IDLE',
    contestants: [],
    activeContestantIndex: -1,
    winnerUid: null,
    winnerStudentId: null,
    winnerNameSnapshot: null,
    winnerAcceptedAt: null,
    winnerLatencyMs: null,
    roundOpenedAt: null,
    roundClosedAt: null,
    attempts: [],
  };

  session.rounds[newRoundId] = newRound;
  session.currentRoundId = newRoundId;
  persistDb();

  broadcastToSession(sessionId, 'round_next_ready', {
    roundId: newRoundId,
    round: newRound,
  });

  res.json({ success: true, round: newRound });
});

/* ==========================================================================
   STUDENT ROSTER & MANAGEMENT ROUTES (ADMIN ONLY)
   ========================================================================== */

// Get all students
app.get('/api/admin/students', authMiddleware, adminOnly, (_req, res) => {
  const students = Object.values(db.users)
    .filter(u => u.role === 'student')
    .map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      studentId: u.studentId || 'N/A',
      role: u.role,
      accountStatus: u.accountStatus,
      createdAt: u.createdAt,
    }));
  res.json({ students });
});

// Add single student
app.post('/api/admin/students', authMiddleware, adminOnly, (req, res) => {
  const { displayName, studentId, email, password } = req.body;

  if (!displayName || !studentId || !email || !password) {
    res.status(400).json({ error: 'Name, Student ID, Email, and Password are all required.' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanStudentId = String(studentId).trim().toUpperCase();

  // Check unique email and studentId
  const existing = Object.values(db.users).find(
    u => u.email.toLowerCase() === cleanEmail || (u.studentId && u.studentId.toUpperCase() === cleanStudentId)
  );

  if (existing) {
    res.status(409).json({ error: 'A student with this Email or Student ID already exists.' });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(String(password), salt);
  const uid = `stu_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const newStudent = {
    uid,
    email: cleanEmail,
    displayName: String(displayName).trim(),
    studentId: cleanStudentId,
    role: 'student' as const,
    accountStatus: 'active' as const,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash,
  };

  db.users[uid] = newStudent;
  persistDb();

  res.status(201).json({
    student: {
      uid,
      email: newStudent.email,
      displayName: newStudent.displayName,
      studentId: newStudent.studentId,
      role: newStudent.role,
      accountStatus: newStudent.accountStatus,
      createdAt: newStudent.createdAt,
    },
  });
});

// Update student account
app.patch('/api/admin/students/:uid', authMiddleware, adminOnly, (req, res) => {
  const { uid } = req.params;
  const { displayName, studentId, email, accountStatus } = req.body;

  const student = db.users[uid];
  if (!student || student.role !== 'student') {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  if (displayName) student.displayName = String(displayName).trim();
  if (studentId) student.studentId = String(studentId).trim().toUpperCase();
  if (email) student.email = String(email).trim().toLowerCase();
  if (accountStatus && ['active', 'disabled'].includes(accountStatus)) {
    student.accountStatus = accountStatus;
  }

  persistDb();
  res.json({ success: true, student });
});

// Reset student password
app.post('/api/admin/students/:uid/reset-password', authMiddleware, adminOnly, (req, res) => {
  const { uid } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }

  const student = db.users[uid];
  if (!student) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  student.salt = salt;
  student.passwordHash = hashPassword(String(newPassword), salt);
  persistDb();

  res.json({ success: true, message: 'Password updated successfully' });
});

// CSV Import of students
app.post('/api/admin/students/import-csv', authMiddleware, adminOnly, (req, res) => {
  const { csvContent } = req.body;
  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({ error: 'csvContent string is required' });
    return;
  }

  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    res.status(400).json({ error: 'CSV must contain a header row and at least one student data row.' });
    return;
  }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const nameIdx = header.findIndex(h => h.includes('name'));
  const idIdx = header.findIndex(h => h.includes('id') || h.includes('usn') || h.includes('roll'));
  const emailIdx = header.findIndex(h => h.includes('email'));
  const passIdx = header.findIndex(h => h.includes('pass'));

  if (nameIdx === -1 || idIdx === -1 || emailIdx === -1) {
    res.status(400).json({
      error: 'CSV headers must include Name, Student ID (or USN), and Email columns (Password is optional, defaults to "student123").',
    });
    return;
  }

  let importedCount = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    const name = cols[nameIdx];
    const sId = cols[idIdx]?.toUpperCase();
    const email = cols[emailIdx]?.toLowerCase();
    const password = passIdx !== -1 && cols[passIdx] ? cols[passIdx] : 'student123';

    if (!name || !sId || !email) {
      errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }

    // Check duplicate
    const exists = Object.values(db.users).some(
      u => u.email.toLowerCase() === email || (u.studentId && u.studentId.toUpperCase() === sId)
    );

    if (exists) {
      errors.push(`Row ${i + 1}: Student with ID ${sId} or email ${email} already exists`);
      continue;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const uid = `stu_${Date.now()}_${i}_${crypto.randomBytes(2).toString('hex')}`;
    db.users[uid] = {
      uid,
      email,
      displayName: name,
      studentId: sId,
      role: 'student',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: hashPassword(password, salt),
    };
    importedCount++;
  }

  persistDb();

  res.json({
    success: true,
    importedCount,
    errors,
  });
});

/* ==========================================================================
   REPORTS & CSV EXPORT ROUTES
   ========================================================================== */

app.get('/api/admin/reports/:sessionId/export-csv', authMiddleware, adminOnly, (req, res) => {
  const { sessionId } = req.params;
  const session = db.sessions[sessionId];
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const rows: string[] = [];
  rows.push('Session Title,Round Number,Question,Status,Winner Name,Winner Student ID,Accepted Timestamp,Response Latency (ms),Total Attempts');

  for (const round of Object.values(session.rounds)) {
    const qText = `"${(round.questionText || '').replace(/"/g, '""')}"`;
    const wName = `"${(round.winnerNameSnapshot || 'None').replace(/"/g, '""')}"`;
    const wId = round.winnerStudentId || 'N/A';
    const acceptedAt = round.winnerAcceptedAt ? new Date(round.winnerAcceptedAt).toISOString() : 'N/A';
    const latency = round.winnerLatencyMs !== null ? `${round.winnerLatencyMs}` : 'N/A';
    const attemptCount = round.attempts.length;

    rows.push(
      `"${session.title.replace(/"/g, '""')}",${round.roundNumber},${qText},${round.status},${wName},${wId},${acceptedAt},${latency},${attemptCount}`
    );
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="QuickBuzz_${session.sessionCode}_Report.csv"`);
  res.send(rows.join('\n'));
});

// System Stats summary
app.get('/api/admin/stats', authMiddleware, adminOnly, (_req, res) => {
  const totalStudents = Object.values(db.users).filter(u => u.role === 'student').length;
  const activeStudents = Object.values(db.users).filter(u => u.role === 'student' && u.accountStatus === 'active').length;
  const totalSessions = Object.keys(db.sessions).length;
  let totalRoundsPlayed = 0;
  for (const s of Object.values(db.sessions)) {
    totalRoundsPlayed += Object.keys(s.rounds).length;
  }
  const connectedStudents = Array.from(sseClients.values()).filter(c => c.role === 'student').length;

  res.json({
    totalStudents,
    activeStudents,
    connectedStudents,
    totalSessions,
    totalRoundsPlayed,
  });
});

/* ==========================================================================
   VITE / STATIC SERVING
   ========================================================================== */

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const serverPrimary = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 QuickBuzz Primary Server running at http://localhost:${PORT} [${isDev ? 'development' : 'production'}]`);
  });

  serverPrimary.on('error', (err: any) => {
    console.error(`❌ Primary server error on port ${PORT}:`, err.message);
  });

  if (SECONDARY_PORT && SECONDARY_PORT !== PORT) {
    const serverSecondary = app.listen(SECONDARY_PORT, '0.0.0.0', () => {
      console.log(`🚀 QuickBuzz Secondary Server running at http://localhost:${SECONDARY_PORT} [separate browser storage/session]`);
      console.log(`👉 Primary Port   (Admin Dashboard)   : http://localhost:${PORT}`);
      console.log(`👉 Secondary Port (Student Dashboard) : http://localhost:${SECONDARY_PORT}`);
    });

    serverSecondary.on('error', (err: any) => {
      console.warn(`⚠️ Secondary port ${SECONDARY_PORT} warning:`, err.message);
    });
  }
}

startServer();
