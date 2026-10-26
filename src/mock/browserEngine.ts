import type { UserProfile, QuizSession, Round, BuzzAttempt, BuzzResponse } from '../types/quiz.js';

interface DatabaseSchema {
  users: Record<string, UserProfile & { passwordHash: string }>;
  sessions: Record<string, QuizSession>;
  authTokens: Record<string, string>;
}

const STORAGE_KEY = 'quickbuzz_mock_db_v1';
const CHANNEL_NAME = 'quickbuzz_mock_channel';

function getInitialMockDb(): DatabaseSchema {
  const adminUid = 'admin_root_1';
  const initialUsers: DatabaseSchema['users'] = {
    [adminUid]: {
      uid: adminUid,
      email: 'fardinrit@gmail.com',
      displayName: 'Quizmaster Admin',
      role: 'admin',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      passwordHash: 'Fardin@RIT07',
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
          questionText: 'What algorithm is primarily used in distributed consensus engines like Raft and Paxos?',
          status: 'IDLE',
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

  return {
    users: initialUsers,
    sessions: initialSessions,
    authTokens: {
      'mock_token_admin': adminUid,
    },
  };
}

function loadDb(): DatabaseSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const init = getInitialMockDb();
  saveDb(init);
  return init;
}

function saveDb(db: DatabaseSchema) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

// BroadcastChannel for cross-tab real-time sync
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

function broadcast(event: string, data: any) {
  if (channel) {
    channel.postMessage({ event, data, timestamp: Date.now() });
  }
}

// Mock EventSource class for SSE polyfill
class MockEventSource extends EventTarget {
  url: string;
  readyState: number = 0;
  private token: string | null = null;
  private sessionId: string | null = null;
  private onMessageCallback: ((msg: any) => void) | null = null;

  constructor(url: string) {
    super();
    this.url = url;
    try {
      const parsed = new URL(url, window.location.origin);
      this.token = parsed.searchParams.get('token');
      this.sessionId = parsed.searchParams.get('sessionId') || 'ses_main_2026';
    } catch {
      // fallback
    }

    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen(new Event('open'));

      // Send initial state snapshot
      this.sendCurrentState();
    }, 50);

    // Listen for broadcast events from other tabs
    this.onMessageCallback = (msgEvent: any) => {
      const { event, data } = msgEvent.data || {};
      if (!event) return;
      const customEvent = new MessageEvent(event, { data: JSON.stringify(data) });
      this.dispatchEvent(customEvent);
    };

    if (channel) {
      channel.addEventListener('message', this.onMessageCallback);
    }
  }

  set onopen(handler: ((e: Event) => void) | null) {
    this._onopen = handler;
  }
  get onopen() {
    return this._onopen;
  }
  private _onopen: ((e: Event) => void) | null = null;

  set onerror(handler: ((e: Event) => void) | null) {
    this._onerror = handler;
  }
  get onerror() {
    return this._onerror;
  }
  private _onerror: ((e: Event) => void) | null = null;

  sendCurrentState() {
    const db = loadDb();
    const session = db.sessions[this.sessionId || 'ses_main_2026'] || Object.values(db.sessions)[0];
    if (!session) return;
    const currentRound = session.currentRoundId ? session.rounds[session.currentRoundId] : null;

    const payload = {
      session,
      currentRound,
      connectedCount: Object.keys(session.participants).length,
      serverTime: Date.now(),
    };

    const stateEvent = new MessageEvent('state', { data: JSON.stringify(payload) });
    this.dispatchEvent(stateEvent);
  }

  close() {
    this.readyState = 2;
    if (channel && this.onMessageCallback) {
      channel.removeEventListener('message', this.onMessageCallback);
    }
  }
}

export function initBrowserEngine() {
  const isGithubPages = typeof window !== 'undefined' && (
    window.location.hostname.includes('github.io') ||
    window.location.hostname.includes('localhost') === false ||
    window.location.search.includes('mock=true')
  );

  // If we are running in full-stack local server mode with active server.ts on port 3000,
  // do not mock unless explicitly requested via ?mock=true
  if (typeof window !== 'undefined' && window.location.port === '3000' && !window.location.search.includes('mock=true')) {
    return;
  }

  console.log('⚡ QuickBuzz: Running in Standalone In-Browser Real-Time Mode (GitHub Pages compatible)');

  // Polyfill EventSource for /api/live/stream
  const OriginalEventSource = window.EventSource;
  window.EventSource = function (url: string | URL, eventSourceInitDict?: EventSourceInit) {
    const urlStr = url.toString();
    if (urlStr.includes('/api/live/stream')) {
      return new MockEventSource(urlStr) as unknown as EventSource;
    }
    return new OriginalEventSource(url, eventSourceInitDict);
  } as unknown as typeof EventSource;

  // Polyfill fetch for /api/*
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (!urlStr.includes('/api/')) {
      return originalFetch(input, init);
    }

    const url = new URL(urlStr, window.location.origin);
    const pathname = url.pathname.replace(/\/Quiz-Buzzer/, ''); // Strip repo base path if present
    const method = (init?.method || 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    const authHeader = headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const bodyText = typeof init?.body === 'string' ? init.body : '';
    let body: any = {};
    try {
      if (bodyText) body = JSON.parse(bodyText);
    } catch {
      // not json
    }

    const db = loadDb();

    function jsonResponse(data: any, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. GET /api/auth/me
    if (pathname === '/api/auth/me' && method === 'GET') {
      const uid = db.authTokens[token];
      const user = uid ? db.users[uid] : null;
      if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
      const { passwordHash: _, ...safeUser } = user;
      return jsonResponse({ user: safeUser });
    }

    // 2. POST /api/auth/login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { identifier, password } = body;
      const targetUser = Object.values(db.users).find(
        u => u.email.toLowerCase() === (identifier || '').toLowerCase() ||
             (u.studentId && u.studentId.toUpperCase() === (identifier || '').toUpperCase())
      );

      if (!targetUser) {
        return jsonResponse({ error: 'User account not found' }, 401);
      }
      if (targetUser.accountStatus === 'disabled') {
        return jsonResponse({ error: 'Account has been disabled' }, 403);
      }
      // Simple validation for mock mode (or password123 / Fardin@RIT07)
      if (password !== targetUser.passwordHash && password !== 'password123' && password !== 'Fardin@RIT07') {
        return jsonResponse({ error: 'Invalid password credential' }, 401);
      }

      const newToken = `mock_token_${targetUser.uid}_${Date.now()}`;
      db.authTokens[newToken] = targetUser.uid;
      saveDb(db);

      const { passwordHash: _, ...safeUser } = targetUser;
      return jsonResponse({ token: newToken, user: safeUser });
    }

    // 3. POST /api/auth/logout
    if (pathname === '/api/auth/logout') {
      if (token && db.authTokens[token]) {
        delete db.authTokens[token];
        saveDb(db);
      }
      return jsonResponse({ success: true });
    }

    // 4. POST /api/sessions/quick-join
    if (pathname === '/api/sessions/quick-join' && method === 'POST') {
      const { name, sessionPin, studentId } = body;
      const session = Object.values(db.sessions).find(
        s => s.sessionCode.toUpperCase() === (sessionPin || '').toUpperCase()
      ) || Object.values(db.sessions)[0];

      if (!session) {
        return jsonResponse({ error: 'Session PIN not found' }, 404);
      }

      const uid = `stu_temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newUser: UserProfile = {
        uid,
        email: `${name.toLowerCase().replace(/\s+/g, '.') || 'guest'}@temp.quiz`,
        displayName: name || 'Quick Student',
        studentId: studentId ? studentId.toUpperCase() : `TMP-${Math.floor(Math.random() * 9000 + 1000)}`,
        role: 'student',
        accountStatus: 'active',
        createdAt: new Date().toISOString(),
      };

      db.users[uid] = { ...newUser, passwordHash: 'password123' };
      const newToken = `mock_token_${uid}`;
      db.authTokens[newToken] = uid;

      session.participants[uid] = {
        uid,
        displayName: newUser.displayName,
        studentId: newUser.studentId!,
        joinedAt: new Date().toISOString(),
        lastSeen: Date.now(),
        isConnected: true,
      };

      saveDb(db);
      broadcast('participant_joined', { participant: session.participants[uid] });

      return jsonResponse({ token: newToken, user: newUser, session });
    }

    // 5. POST /api/sessions/join
    if (pathname === '/api/sessions/join' && method === 'POST') {
      const { sessionCode } = body;
      const session = Object.values(db.sessions).find(
        s => s.sessionCode.toUpperCase() === (sessionCode || '').toUpperCase()
      ) || Object.values(db.sessions)[0];
      return jsonResponse({ session });
    }

    // 6. POST /api/sessions/:sessionId/rounds/:roundId/buzz
    const buzzMatch = pathname.match(/\/api\/sessions\/([^/]+)\/rounds\/([^/]+)\/buzz$/);
    if (buzzMatch && method === 'POST') {
      const [, sId, rId] = buzzMatch;
      const session = db.sessions[sId] || Object.values(db.sessions)[0];
      if (!session) return jsonResponse({ error: 'Session not found' }, 404);
      const round = session.rounds[rId];
      if (!round) return jsonResponse({ error: 'Round not found' }, 404);

      const callerUid = db.authTokens[token];
      const callerUser = callerUid ? db.users[callerUid] : null;
      const displayName = callerUser?.displayName || 'Student';
      const studentId = callerUser?.studentId || 'N/A';
      const now = Date.now();

      if (round.status === 'OPEN') {
        round.status = 'WINNER_LOCKED';
        round.winnerUid = callerUid || 'anon';
        round.winnerStudentId = studentId;
        round.winnerNameSnapshot = displayName;
        round.winnerAcceptedAt = now;
        const latency = round.roundOpenedAt ? Math.max(1, now - round.roundOpenedAt) : 120;
        round.winnerLatencyMs = latency;

        const attempt: BuzzAttempt = {
          uid: callerUid || 'anon',
          studentId,
          displayName,
          submittedAt: now,
          status: 'ACCEPTED_WINNER',
          latencyMs: latency,
        };
        round.attempts.unshift(attempt);

        saveDb(db);

        const winnerPayload = {
          winner: { name: displayName, studentId, latencyMs: latency },
          round,
        };

        broadcast('winner_selected', winnerPayload);
        broadcast('buzz_attempt', { attempt });

        const resp: BuzzResponse = {
          accepted: true,
          reason: 'WINNER',
          latencyMs: latency,
          winner: { name: displayName, studentId, latencyMs: latency },
        };
        return jsonResponse(resp);
      } else {
        const latency = round.roundOpenedAt ? Math.max(1, now - round.roundOpenedAt) : 999;
        const attempt: BuzzAttempt = {
          uid: callerUid || 'anon',
          studentId,
          displayName,
          submittedAt: now,
          status: 'REJECTED_TOO_LATE',
          latencyMs: latency,
        };
        round.attempts.push(attempt);
        saveDb(db);

        broadcast('buzz_attempt', { attempt });

        const resp: BuzzResponse = {
          accepted: false,
          reason: 'TOO_LATE',
          latencyMs: latency,
          winner: round.winnerNameSnapshot
            ? {
                name: round.winnerNameSnapshot,
                studentId: round.winnerStudentId || '',
                latencyMs: round.winnerLatencyMs,
              }
            : undefined,
        };
        return jsonResponse(resp);
      }
    }

    // 7. POST /api/admin/sessions/:sessionId/rounds/open
    const openMatch = pathname.match(/\/api\/admin\/sessions\/([^/]+)\/rounds\/open$/);
    if (openMatch && method === 'POST') {
      const [, sId] = openMatch;
      const session = db.sessions[sId] || Object.values(db.sessions)[0];
      if (!session) return jsonResponse({ error: 'Session not found' }, 404);

      let round = session.currentRoundId ? session.rounds[session.currentRoundId] : null;
      if (!round) {
        const newRId = `rnd_${Date.now()}`;
        round = {
          roundId: newRId,
          roundNumber: Object.keys(session.rounds).length + 1,
          questionText: body.questionText || '',
          status: 'IDLE',
          winnerUid: null,
          winnerStudentId: null,
          winnerNameSnapshot: null,
          winnerAcceptedAt: null,
          winnerLatencyMs: null,
          roundOpenedAt: null,
          roundClosedAt: null,
          attempts: [],
        };
        session.rounds[newRId] = round;
        session.currentRoundId = newRId;
      }

      if (body.questionText) round.questionText = body.questionText;
      round.status = 'OPEN';
      round.roundOpenedAt = Date.now();
      round.winnerUid = null;
      round.winnerNameSnapshot = null;
      round.winnerStudentId = null;
      round.winnerAcceptedAt = null;
      round.winnerLatencyMs = null;
      round.attempts = [];

      saveDb(db);
      broadcast('round_opened', { round });

      return jsonResponse({ success: true, round });
    }

    // 8. POST /api/admin/sessions/:sessionId/rounds/:roundId/close
    const closeMatch = pathname.match(/\/api\/admin\/sessions\/([^/]+)\/rounds\/([^/]+)\/close$/);
    if (closeMatch && method === 'POST') {
      const [, sId, rId] = closeMatch;
      const session = db.sessions[sId] || Object.values(db.sessions)[0];
      if (!session) return jsonResponse({ error: 'Session not found' }, 404);
      const round = session.rounds[rId];
      if (!round) return jsonResponse({ error: 'Round not found' }, 404);

      round.status = 'CLOSED';
      round.roundClosedAt = Date.now();
      saveDb(db);
      broadcast('round_closed', { round });

      return jsonResponse({ success: true, round });
    }

    // 9. POST /api/admin/sessions/:sessionId/rounds/next
    const nextMatch = pathname.match(/\/api\/admin\/sessions\/([^/]+)\/rounds\/next$/);
    if (nextMatch && method === 'POST') {
      const [, sId] = nextMatch;
      const session = db.sessions[sId] || Object.values(db.sessions)[0];
      if (!session) return jsonResponse({ error: 'Session not found' }, 404);

      if (session.currentRoundId && session.rounds[session.currentRoundId]) {
        session.rounds[session.currentRoundId].status = 'CLOSED';
        session.rounds[session.currentRoundId].roundClosedAt = Date.now();
      }

      const nextNum = Object.keys(session.rounds).length + 1;
      const newRoundId = `rnd_q${nextNum}_${Date.now()}`;
      const newRound: Round = {
        roundId: newRoundId,
        roundNumber: nextNum,
        questionText: body.questionText || '',
        status: 'OPEN',
        winnerUid: null,
        winnerStudentId: null,
        winnerNameSnapshot: null,
        winnerAcceptedAt: null,
        winnerLatencyMs: null,
        roundOpenedAt: Date.now(),
        roundClosedAt: null,
        attempts: [],
      };

      session.rounds[newRoundId] = newRound;
      session.currentRoundId = newRoundId;
      saveDb(db);

      broadcast('round_opened', { round: newRound });

      return jsonResponse({ success: true, session, round: newRound });
    }

    // 10. GET /api/admin/stats
    if (pathname === '/api/admin/stats') {
      const totalStudents = Object.values(db.users).filter(u => u.role === 'student').length;
      const activeStudents = Object.values(db.users).filter(u => u.role === 'student' && u.accountStatus === 'active').length;
      const totalSessions = Object.keys(db.sessions).length;
      let totalRoundsPlayed = 0;
      for (const s of Object.values(db.sessions)) {
        totalRoundsPlayed += Object.keys(s.rounds).length;
      }
      return jsonResponse({
        totalStudents,
        activeStudents,
        connectedStudents: activeStudents,
        totalSessions,
        totalRoundsPlayed,
      });
    }

    // 11. GET /api/admin/students
    if (pathname === '/api/admin/students' && method === 'GET') {
      const students = Object.values(db.users)
        .filter(u => u.role === 'student')
        .map(({ passwordHash: _, ...safe }) => safe);
      return jsonResponse({ students });
    }

    // 12. POST /api/admin/students
    if (pathname === '/api/admin/students' && method === 'POST') {
      const { email, displayName, studentId, temporaryPassword } = body;
      const uid = `stu_${Date.now()}`;
      const newStudent: UserProfile = {
        uid,
        email,
        displayName,
        studentId,
        role: 'student',
        accountStatus: 'active',
        createdAt: new Date().toISOString(),
      };
      db.users[uid] = { ...newStudent, passwordHash: temporaryPassword || 'password123' };
      saveDb(db);
      return jsonResponse({ student: newStudent }, 201);
    }

    // 13. PATCH /api/admin/students/:uid
    const patchStudentMatch = pathname.match(/\/api\/admin\/students\/([^/]+)$/);
    if (patchStudentMatch && method === 'PATCH') {
      const [, targetUid] = patchStudentMatch;
      const user = db.users[targetUid];
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      if (body.accountStatus) user.accountStatus = body.accountStatus;
      if (body.displayName) user.displayName = body.displayName;
      if (body.studentId) user.studentId = body.studentId;
      saveDb(db);
      const { passwordHash: _, ...safe } = user;
      return jsonResponse({ student: safe });
    }

    // 14. POST /api/admin/students/:uid/reset-password
    const resetPassMatch = pathname.match(/\/api\/admin\/students\/([^/]+)\/reset-password$/);
    if (resetPassMatch && method === 'POST') {
      const [, targetUid] = resetPassMatch;
      const user = db.users[targetUid];
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      user.passwordHash = 'password123';
      saveDb(db);
      return jsonResponse({ success: true, temporaryPassword: 'password123' });
    }

    // 15. GET /api/admin/sessions
    if (pathname === '/api/admin/sessions' && method === 'GET') {
      return jsonResponse({ sessions: Object.values(db.sessions) });
    }

    // 16. POST /api/admin/sessions
    if (pathname === '/api/admin/sessions' && method === 'POST') {
      const { title, sessionCode } = body;
      const sId = `ses_${Date.now()}`;
      const rId = `rnd_q1_${Date.now()}`;
      const newSession: QuizSession = {
        sessionId: sId,
        title: title || 'New Quiz Session',
        sessionCode: (sessionCode || `BZ${Math.floor(Math.random() * 900 + 100)}`).toUpperCase(),
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: db.authTokens[token] || 'admin',
        currentRoundId: rId,
        rounds: {
          [rId]: {
            roundId: rId,
            roundNumber: 1,
            questionText: 'Round 1 Question',
            status: 'IDLE',
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
      };
      db.sessions[sId] = newSession;
      saveDb(db);
      return jsonResponse({ session: newSession }, 201);
    }

    // 17. GET /api/admin/reports/:sessionId/export-csv
    const exportCsvMatch = pathname.match(/\/api\/admin\/reports\/([^/]+)\/export-csv$/);
    if (exportCsvMatch && method === 'GET') {
      const [, sId] = exportCsvMatch;
      const session = db.sessions[sId] || Object.values(db.sessions)[0];
      const rows: string[] = [
        'Session Title,Round Number,Question,Status,Winner Name,Winner Student ID,Accepted Timestamp,Response Latency (ms),Total Attempts',
      ];
      if (session) {
        for (const r of Object.values(session.rounds)) {
          const qText = `"${(r.questionText || '').replace(/"/g, '""')}"`;
          const wName = `"${(r.winnerNameSnapshot || 'None').replace(/"/g, '""')}"`;
          const wId = r.winnerStudentId || 'N/A';
          const accepted = r.winnerAcceptedAt ? new Date(r.winnerAcceptedAt).toISOString() : 'N/A';
          const latency = r.winnerLatencyMs ?? 'N/A';
          rows.push(`"${session.title}",${r.roundNumber},${qText},${r.status},${wName},${wId},${accepted},${latency},${r.attempts.length}`);
        }
      }
      return new Response(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="QuickBuzz_Report.csv"`,
        },
      });
    }

    return jsonResponse({ error: 'Not found in mock engine' }, 404);
  };
}
