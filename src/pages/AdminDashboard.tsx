import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import { sound } from '../utils/audio.js';
import { apiUrl } from '../utils/api.js';
import {
  Zap,
  Radio,
  Users,
  Layers,
  FileSpreadsheet,
  Settings,
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  Square,
  SkipForward,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  Upload,
  Download,
  Key,
  Shield,
  Volume2,
  VolumeX,
  Hash,
  AlertTriangle,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';

interface StudentItem {
  uid: string;
  email: string;
  displayName: string;
  studentId: string;
  role: 'student';
  accountStatus: 'active' | 'disabled';
  createdAt: string;
}

interface SessionListItem {
  sessionId: string;
  title: string;
  sessionCode: string;
  status: 'waiting' | 'active' | 'completed';
  createdAt: string;
  roundCount: number;
  participantCount: number;
}

export const AdminDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<
    'live' | 'students' | 'sessions' | 'reports' | 'settings'
  >('live');

  // Active Session
  const [activeSessionId, setActiveSessionId] = useState<string>('ses_main_2026');
  const [sessionsList, setSessionsList] = useState<SessionListItem[]>([]);

  // Projector Fullscreen Mode
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);

  // Question input
  const [questionInput, setQuestionInput] = useState<string>('');

  // Audio preference
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted());

  // Student roster state
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState<boolean>(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState<boolean>(false);
  const [isResetPassOpen, setIsResetPassOpen] = useState<boolean>(false);
  const [selectedStudentForPass, setSelectedStudentForPass] = useState<StudentItem | null>(null);

  // Form states
  const [newStudentForm, setNewStudentForm] = useState({
    displayName: '',
    studentId: '',
    email: '',
    password: '',
  });
  const [newPassInput, setNewPassInput] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [csvStatusMessage, setCsvStatusMessage] = useState<string | null>(null);

  // New session modal
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionCode, setNewSessionCode] = useState('');

  // Live session hook
  const {
    session,
    currentRound,
    participants,
    attempts,
    isConnected,
    lastWinnerInfo,
    openRound,
    closeRound,
    nextRound,
  } = useLiveSession({
    token,
    sessionId: activeSessionId,
    userRole: 'admin',
    userId: user?.uid,
  });

  const toggleSound = () => {
    const next = !isMuted;
    sound.setMuted(next);
    setIsMuted(next);
  };

  // Fetch student roster
  const fetchStudents = async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/admin/students'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  // Fetch sessions
  const fetchSessions = async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/admin/sessions'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchSessions();
  }, [token]);

  // Round Actions
  const handleOpenRound = async () => {
    try {
      await openRound(questionInput.trim() || undefined);
    } catch (err) {
      alert('Error opening round: ' + err);
    }
  };

  const handleCloseRound = async () => {
    await closeRound();
  };

  const handleNextRound = async () => {
    await nextRound(questionInput.trim() || undefined);
    setQuestionInput('');
  };

  // Student Actions
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/admin/students'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newStudentForm),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create student');
        return;
      }
      setIsAddStudentOpen(false);
      setNewStudentForm({ displayName: '', studentId: '', email: '', password: '' });
      fetchStudents();
    } catch {
      alert('Network error adding student');
    }
  };

  const handleToggleStudentStatus = async (student: StudentItem) => {
    if (!token) return;
    const nextStatus = student.accountStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(apiUrl(`/api/admin/students/${student.uid}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accountStatus: nextStatus }),
      });
      if (res.ok) {
        fetchStudents();
      }
    } catch {
      alert('Failed to update student status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStudentForPass) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/students/${selectedStudentForPass.uid}/reset-password`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: newPassInput }),
      });
      if (res.ok) {
        setIsResetPassOpen(false);
        setNewPassInput('');
        setSelectedStudentForPass(null);
        alert('Password updated successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset password');
      }
    } catch {
      alert('Network error updating password');
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !csvInput.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/admin/students/import-csv'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ csvContent: csvInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setCsvStatusMessage(`Imported ${data.importedCount} student(s) successfully!`);
        fetchStudents();
        setTimeout(() => {
          setIsCsvImportOpen(false);
          setCsvInput('');
          setCsvStatusMessage(null);
        }, 1500);
      } else {
        setCsvStatusMessage(`Error: ${data.error}`);
      }
    } catch {
      setCsvStatusMessage('Network error during CSV upload');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newSessionTitle.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/admin/sessions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newSessionTitle.trim(),
          customCode: newSessionCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSessionId(data.session.sessionId);
        setIsNewSessionOpen(false);
        setNewSessionTitle('');
        setNewSessionCode('');
        fetchSessions();
      } else {
        alert(data.error || 'Failed to create session');
      }
    } catch {
      alert('Error creating quiz session');
    }
  };

  const handleExportCsv = () => {
    if (!activeSessionId) return;
    window.location.href = apiUrl(`/api/admin/reports/${activeSessionId}/export-csv?token=${encodeURIComponent(token || '')}`);
  };

  // Filtered student list
  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.displayName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesFilter =
      studentFilter === 'all' ? true : s.accountStatus === studentFilter;
    return matchesSearch && matchesFilter;
  });

  const connectedParticipantsCount = Object.values(participants).filter(p => p.isConnected).length;
  const isRoundOpen = currentRound?.status === 'OPEN';
  const isWinnerLocked = currentRound?.status === 'WINNER_LOCKED';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                QuickBuzz
              </span>
              <span className="hidden sm:inline-block text-xs text-cyan-400 ml-2 font-mono uppercase bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                Admin Center
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border bg-emerald-950/40 border-emerald-500/40 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{connectedParticipantsCount} LIVE STUDENTS</span>
            </div>

            {/* Projector Mode Toggle Button */}
            <button
              onClick={() => setIsProjectorMode(!isProjectorMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors ${
                isProjectorMode
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title="Projector / Fullscreen Audience Mode"
            >
              {isProjectorMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isProjectorMode ? 'EXIT PROJECTOR' : 'PROJECTOR MODE'}</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title={isMuted ? 'Unmute Chimes' : 'Mute Chimes'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/50 hover:text-red-400 text-slate-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Nav (Hidden in Projector Mode) */}
        {!isProjectorMode && (
          <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/40 p-3 flex md:flex-col justify-between overflow-x-auto md:overflow-x-visible">
            <nav className="flex md:flex-col gap-1 w-full">
              <button
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors w-full ${
                  activeTab === 'live'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>Live Quiz Control</span>
              </button>

              <button
                onClick={() => setActiveTab('students')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors w-full ${
                  activeTab === 'students'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Student Roster ({students.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('sessions')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors w-full ${
                  activeTab === 'sessions'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Quiz Sessions</span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors w-full ${
                  activeTab === 'reports'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Reports & CSV</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors w-full ${
                  activeTab === 'settings'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Platform Settings</span>
              </button>
            </nav>

            <div className="hidden md:block pt-4 border-t border-slate-800 text-xs text-slate-500 font-mono">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Root Administrator</span>
              </div>
              <span className="truncate block">{user?.email}</span>
            </div>
          </aside>
        )}

        {/* Center Panel Content */}
        <main className={`flex-1 p-4 md:p-6 overflow-y-auto ${isProjectorMode ? 'max-w-6xl mx-auto' : ''}`}>
          {/* TAB: LIVE QUIZ (The Core Control Center) */}
          {(activeTab === 'live' || isProjectorMode) && (
            <div className="space-y-6">
              {/* Session Overview Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                <div>
                  <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider block">
                    ACTIVE QUIZ SESSION
                  </span>
                  <h1 className="text-lg md:text-xl font-black text-white">{session?.title}</h1>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-700/80">
                    <Hash className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">SESSION PIN</span>
                      <span className="text-base font-black font-mono tracking-widest text-white">
                        {session?.sessionCode || '------'}
                      </span>
                    </div>
                  </div>

                  {!isProjectorMode && (
                    <button
                      onClick={fetchSessions}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
                      title="Refresh Session"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* GIANT LIVE WINNER PANEL (Most important element!) */}
              <div className="relative overflow-hidden rounded-3xl border-2 border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 md:p-10 shadow-2xl transition-all">
                {isRoundOpen && (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <div className="relative mb-4">
                      <div className="w-20 h-20 rounded-full bg-cyan-500/20 border-2 border-cyan-400 animate-pulse-ring flex items-center justify-center">
                        <Zap className="w-10 h-10 text-cyan-400 animate-bounce" />
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400 mb-2">
                      REAL-TIME RACE ACTIVE
                    </span>
                    <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                      BUZZER IS OPEN — WAITING FOR FIRST RESPONSE
                    </h2>
                    <p className="text-sm text-slate-400 mt-2 max-w-lg font-mono">
                      Students are buzzing now. Atomic first-come lock will accept exactly one winner.
                    </p>
                  </div>
                )}

                {isWinnerLocked && lastWinnerInfo && (
                  <div className="flex flex-col items-center justify-center text-center py-6 animate-fadeIn">
                    <div className="inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest uppercase mb-4 shadow-lg shadow-emerald-900/20">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span>WINNER LOCKED — ROUND #{currentRound?.roundNumber}</span>
                    </div>

                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">
                      {lastWinnerInfo.name}
                    </h2>

                    <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-mono mt-2">
                      <span className="bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700 text-cyan-300 font-bold">
                        STUDENT ID: {lastWinnerInfo.studentId}
                      </span>
                      {lastWinnerInfo.latencyMs !== null && (
                        <span className="bg-emerald-950/60 px-3.5 py-1.5 rounded-xl border border-emerald-700/50 text-emerald-300 font-bold flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{lastWinnerInfo.latencyMs} ms RESPONSE</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-4 font-mono">
                      All subsequent buzz submissions were atomically locked out and recorded.
                    </p>
                  </div>
                )}

                {!isRoundOpen && !isWinnerLocked && (
                  <div className="flex flex-col items-center justify-center text-center py-8 text-slate-400">
                    <Clock className="w-12 h-12 text-slate-600 mb-3" />
                    <h3 className="text-xl font-bold text-slate-300">Buzzer is currently locked</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      Ask your question verbally or display it below, then press &ldquo;OPEN BUZZER ROUND&rdquo; to unlock contestant buzzers.
                    </p>
                  </div>
                )}
              </div>

              {/* Host Control Actions Bar */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 md:p-6 rounded-2xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-mono uppercase text-slate-400 block mb-1">
                      Optional Question Prompt (Display on screen)
                    </label>
                    <input
                      type="text"
                      value={questionInput}
                      onChange={e => setQuestionInput(e.target.value)}
                      placeholder="e.g. Which algorithm is used for finding shortest paths in a weighted graph?"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2 md:pt-5">
                    {!isRoundOpen ? (
                      <button
                        onClick={handleOpenRound}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 cursor-pointer text-sm tracking-wide transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>OPEN BUZZER ROUND</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseRound}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-lg shadow-red-600/25 cursor-pointer text-sm tracking-wide transition-all"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        <span>CLOSE ROUND</span>
                      </button>
                    )}

                    <button
                      onClick={handleNextRound}
                      className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-colors"
                      title="Prepare Next Question"
                    >
                      <SkipForward className="w-4 h-4" />
                      <span className="hidden sm:inline">NEXT QUESTION</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Race Concurrency Feed & Connected Students grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Live Race Order / Attempts Stream */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>Round #{currentRound?.roundNumber || 1} Buzz Log</span>
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      {attempts.length} Attempt{attempts.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {attempts.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 font-mono">
                      No buzz attempts logged yet for this round.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {attempts.map((att, idx) => {
                        const isWinner = att.status === 'ACCEPTED_WINNER';
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                              isWinner
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                                : 'bg-slate-950/60 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[11px] ${
                                  isWinner ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div>
                                <span className="font-bold block">{att.displayName}</span>
                                <span className="text-[11px] text-slate-400 font-mono">{att.studentId}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span
                                className={`font-mono font-bold block ${
                                  isWinner ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {isWinner ? 'FIRST (ACCEPTED)' : 'REJECTED (TOO LATE)'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                +{att.latencyMs} ms
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Connected Participants */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>Connected Students In Session</span>
                    </h3>
                    <span className="text-xs font-mono text-emerald-400">
                      {connectedParticipantsCount} Active
                    </span>
                  </div>

                  {Object.keys(participants).length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 font-mono">
                      No students connected yet. Share code &ldquo;{session?.sessionCode}&rdquo; with your class.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {Object.values(participants).map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                p.isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'
                              }`}
                            />
                            <div>
                              <span className="font-semibold text-slate-200">{p.displayName}</span>
                              <span className="text-[11px] text-slate-400 font-mono ml-2">({p.studentId})</span>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {p.isConnected ? 'Connected' : 'Offline'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: STUDENTS MANAGEMENT */}
          {activeTab === 'students' && !isProjectorMode && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">Student Account Management</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage authorized contestant accounts, import student lists via CSV, and reset passwords.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddStudentOpen(true)}
                    className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer shadow-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Single Student</span>
                  </button>
                  <button
                    onClick={() => setIsCsvImportOpen(true)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import CSV</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Search by name, email, or USN..."
                    className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setStudentFilter('all')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                      studentFilter === 'all' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({students.length})
                  </button>
                  <button
                    onClick={() => setStudentFilter('active')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                      studentFilter === 'active'
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Active ({students.filter(s => s.accountStatus === 'active').length})
                  </button>
                  <button
                    onClick={() => setStudentFilter('disabled')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                      studentFilter === 'disabled'
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Disabled ({students.filter(s => s.accountStatus === 'disabled').length})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                      <tr>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Student ID / USN</th>
                        <th className="py-3 px-4">Email Address</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                            No student accounts found matching filter.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map(student => (
                          <tr key={student.uid} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-white block">{student.displayName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">UID: {student.uid}</span>
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                              {student.studentId}
                            </td>
                            <td className="py-3 px-4 text-slate-300 font-mono">{student.email}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold ${
                                  student.accountStatus === 'active' ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {student.accountStatus === 'active' ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5" /> Disabled
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedStudentForPass(student);
                                    setIsResetPassOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="Reset Password"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleToggleStudentStatus(student)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    student.accountStatus === 'active'
                                      ? 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300'
                                      : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300'
                                  }`}
                                  title={student.accountStatus === 'active' ? 'Disable Account' : 'Reactivate Account'}
                                >
                                  {student.accountStatus === 'active' ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SESSIONS */}
          {activeTab === 'sessions' && !isProjectorMode && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Quiz Sessions</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Create new quiz competitions, generate access PINs, and review round counts.
                  </p>
                </div>
                <button
                  onClick={() => setIsNewSessionOpen(true)}
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer shadow-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Session</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessionsList.map(s => {
                  const isCurrent = s.sessionId === activeSessionId;
                  return (
                    <div
                      key={s.sessionId}
                      className={`p-5 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'bg-slate-900 border-cyan-500/80 shadow-lg shadow-cyan-500/10'
                          : 'bg-slate-900/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="text-[10px] font-mono text-cyan-400 uppercase">
                            PIN: {s.sessionCode}
                          </span>
                          <h3 className="text-base font-bold text-white mt-0.5">{s.title}</h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            s.status === 'active'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 font-mono my-3">
                        <span>{s.roundCount} Rounds Played</span>
                        <span>•</span>
                        <span>{s.participantCount} Joined</span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Created {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                        {!isCurrent && (
                          <button
                            onClick={() => setActiveSessionId(s.sessionId)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono font-bold cursor-pointer"
                          >
                            Switch to this session →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && !isProjectorMode && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">Quiz Results & CSV Export</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Review official round winners, server timestamps, latencies, and export comprehensive CSV files.
                  </p>
                </div>

                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Full Session CSV</span>
                </button>
              </div>

              {/* Table of rounds */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                      <tr>
                        <th className="py-3 px-4">Round #</th>
                        <th className="py-3 px-4">Question Prompt</th>
                        <th className="py-3 px-4">Winner Name</th>
                        <th className="py-3 px-4">Winner ID</th>
                        <th className="py-3 px-4">Response Latency</th>
                        <th className="py-3 px-4">Total Attempts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {session && Object.values(session.rounds).length > 0 ? (
                        Object.values(session.rounds).map(r => (
                          <tr key={r.roundId} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-cyan-400">#{r.roundNumber}</td>
                            <td className="py-3 px-4 max-w-xs truncate text-slate-200">
                              {r.questionText || <span className="italic text-slate-500">Verbal Question</span>}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              {r.winnerNameSnapshot || <span className="text-slate-500">No Winner</span>}
                            </td>
                            <td className="py-3 px-4 font-mono text-cyan-400">{r.winnerStudentId || 'N/A'}</td>
                            <td className="py-3 px-4 font-mono">
                              {r.winnerLatencyMs !== null ? `${r.winnerLatencyMs} ms` : 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400">{r.attempts.length}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                            No round results available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && !isProjectorMode && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-black text-white">Platform Settings & Security</h2>
                <p className="text-xs text-slate-400 mt-1">
                  System information, audio synthesis preferences, and root administrator credentials.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Authorized Administrator</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Admin Identifier:</span>
                    <span className="font-mono text-white">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Role Authority:</span>
                    <span className="font-mono text-cyan-400">Server Controlled Root Admin</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Buzzer Engine:</span>
                    <span className="font-mono text-emerald-400">Atomic Serialized Mutex</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>Synthesizer Audio Feedback</span>
                </h3>
                <p className="text-xs text-slate-400">
                  QuickBuzz uses the zero-dependency Web Audio API synthesizer for instant zero-latency chimes.
                </p>
                <button
                  onClick={toggleSound}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    isMuted ? 'bg-slate-800 text-slate-400' : 'bg-cyan-600 text-white'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isMuted ? 'Audio Feedback is Muted' : 'Audio Feedback is Enabled'}</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: Add Single Student */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-3">Add Student Account</h3>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.displayName}
                  onChange={e => setNewStudentForm({ ...newStudentForm, displayName: e.target.value })}
                  placeholder="e.g. Rachel Adams"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Student ID / USN</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.studentId}
                  onChange={e => setNewStudentForm({ ...newStudentForm, studentId: e.target.value.toUpperCase() })}
                  placeholder="e.g. 1MS21CS099"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newStudentForm.email}
                  onChange={e => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                  placeholder="e.g. rachel@campus.edu"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newStudentForm.password}
                  onChange={e => setNewStudentForm({ ...newStudentForm, password: e.target.value })}
                  placeholder="e.g. password123"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-md cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Import CSV */}
      {isCsvImportOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Import Students from CSV</h3>
            <p className="text-xs text-slate-400 mb-3">
              Paste CSV text with columns: <span className="font-mono text-cyan-400">Name, Student ID, Email, Password</span>
            </p>

            <form onSubmit={handleImportCsv} className="space-y-3">
              <textarea
                rows={6}
                value={csvInput}
                onChange={e => setCsvInput(e.target.value)}
                placeholder={`Name,Student ID,Email,Password\nElena Gilbert,1MS21CS111,elena@campus.edu,password123\nStefan Salvatore,1MS21CS112,stefan@campus.edu,password123`}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white outline-none focus:border-cyan-500"
              />

              {csvStatusMessage && (
                <div className="text-xs font-mono p-2.5 rounded-lg bg-slate-800 text-cyan-300">
                  {csvStatusMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvImportOpen(false);
                    setCsvStatusMessage(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-md cursor-pointer"
                >
                  Process CSV Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {isResetPassOpen && selectedStudentForPass && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Reset Password</h3>
            <p className="text-xs text-slate-400 mb-4">
              For contestant: <span className="text-white font-bold">{selectedStudentForPass.displayName}</span> ({selectedStudentForPass.studentId})
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">New Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassInput}
                  onChange={e => setNewPassInput(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResetPassOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-md cursor-pointer"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Session */}
      {isNewSessionOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Create Quiz Session</h3>
            <form onSubmit={handleCreateSession} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  value={newSessionTitle}
                  onChange={e => setNewSessionTitle(e.target.value)}
                  placeholder="e.g. Annual CS Quiz Finals"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Custom Access PIN (Optional)</label>
                <input
                  type="text"
                  value={newSessionCode}
                  onChange={e => setNewSessionCode(e.target.value.toUpperCase())}
                  placeholder="Leave empty for auto PIN (e.g. QB4921)"
                  maxLength={8}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewSessionOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-md cursor-pointer"
                >
                  Start Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
