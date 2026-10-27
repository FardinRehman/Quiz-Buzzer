import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import { LeaderboardView } from '../components/LeaderboardView.js';
import { sound } from '../utils/audio.js';
import { apiUrl } from '../utils/api.js';
import { validateAndParseQuestionsCSV } from '../utils/csv.js';
import type { QuestionBankItem } from '../types/quiz.js';
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
  BookOpen,
  Pause,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Sparkles,
  HelpCircle,
  FileText,
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

type AdminTab = 'live' | 'questions' | 'leaderboard' | 'students' | 'sessions' | 'reports' | 'settings';

export const AdminDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>('live');

  // Active Session
  const [activeSessionId, setActiveSessionId] = useState<string>('ses_main_2026');
  const [sessionsList, setSessionsList] = useState<SessionListItem[]>([]);

  // Projector Fullscreen Mode
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);

  // Question input (manual question fallback)
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

  // Question Bank State
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>([]);
  const [questionBankSummary, setQuestionBankSummary] = useState({
    total: 0,
    availableCount: 0,
    usedCount: 0,
  });
  const [questionSearch, setQuestionSearch] = useState<string>('');
  const [questionFilter, setQuestionFilter] = useState<'all' | 'available' | 'used'>('all');
  const [isQuestionCsvModalOpen, setIsQuestionCsvModalOpen] = useState<boolean>(false);
  const [questionCsvText, setQuestionCsvText] = useState<string>('');
  const [questionCsvPreview, setQuestionCsvPreview] = useState<{
    valid: boolean;
    totalDetected: number;
    validCount: number;
    invalidCount: number;
    errors: string[];
    preview: Array<{ question: string; correctAnswer: string }>;
  } | null>(null);
  const [isQuestionCsvLoading, setIsQuestionCsvLoading] = useState<boolean>(false);
  const [questionCsvError, setQuestionCsvError] = useState<string | null>(null);
  const [isConfirmClearBankOpen, setIsConfirmClearBankOpen] = useState<boolean>(false);
  const [isClearingQuestionBank, setIsClearingQuestionBank] = useState<boolean>(false);
  const [isConfirmResetSequenceOpen, setIsConfirmResetSequenceOpen] = useState<boolean>(false);
  const [revealedAnswerIds, setRevealedAnswerIds] = useState<Record<string, boolean>>({});

  // New session modal
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionCode, setNewSessionCode] = useState('');

  // Evaluation & Action states
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  // Live session hook
  const {
    session,
    currentRound,
    participants,
    attempts,
    contestants,
    activeContestant,
    leaderboard,
    isConnected,
    lastWinnerInfo,
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
    const authToken = token || 'admin_master_token_2026';
    try {
      const res = await fetch(apiUrl('/api/admin/students'), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  // Fetch question bank
  const fetchQuestions = async () => {
    const authToken = token || 'admin_master_token_2026';
    try {
      const res = await fetch(apiUrl('/api/admin/questions'), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQuestionBank(data.questions);
        setQuestionBankSummary({
          total: data.total,
          availableCount: data.availableCount,
          usedCount: data.usedCount,
        });
      }
    } catch (err) {
      console.error('Failed to load question bank:', err);
    }
  };

  // Fetch sessions list
  const fetchSessions = async () => {
    const authToken = token || 'admin_master_token_2026';
    try {
      const res = await fetch(apiUrl('/api/admin/sessions'), {
        headers: { Authorization: `Bearer ${authToken}` },
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
    fetchQuestions();
    fetchSessions();
  }, [token]);

  // Handle Question Bank CSV Preview
  const handlePreviewQuestionCsv = (csvContentToPreview: string) => {
    if (!csvContentToPreview.trim()) {
      setQuestionCsvPreview(null);
      setQuestionCsvError(null);
      return;
    }
    try {
      const parseResult = validateAndParseQuestionsCSV(csvContentToPreview);
      setQuestionCsvPreview({
        valid: parseResult.valid,
        totalDetected: parseResult.totalRows,
        validCount: parseResult.validQuestions.length,
        invalidCount: parseResult.errors.length,
        errors: parseResult.errors,
        preview: parseResult.validQuestions.slice(0, 10),
      });
      if (!parseResult.valid && parseResult.errors.length > 0) {
        setQuestionCsvError(parseResult.errors[0]);
      } else {
        setQuestionCsvError(null);
      }
    } catch {
      setQuestionCsvError('Error validating CSV format.');
    }
  };

  // Handle File Upload from Input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = (evt.target?.result as string) || '';
      setQuestionCsvText(text);
      handlePreviewQuestionCsv(text);
    };
    reader.readAsText(file);
  };

  // Handle Question CSV Import
  const handleImportQuestionCsv = async () => {
    if (!questionCsvText.trim()) return;
    setIsQuestionCsvLoading(true);
    setQuestionCsvError(null);
    const authToken = token || 'admin_master_token_2026';
    try {
      const res = await fetch(apiUrl('/api/admin/questions/import-csv'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ csvContent: questionCsvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuestionCsvError(data.error || 'Failed to import CSV');
      } else {
        setIsQuestionCsvModalOpen(false);
        setQuestionCsvText('');
        setQuestionCsvPreview(null);
        fetchQuestions();
        alert(`Successfully imported ${data.importedCount} questions into Question Bank!`);
      }
    } catch {
      setQuestionCsvError('Network error while importing questions');
    } finally {
      setIsQuestionCsvLoading(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/questions/${qId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchQuestions();
      }
    } catch (err) {
      console.error('Failed to delete question:', err);
    }
  };

  // Clear question bank
  const handleClearQuestionBank = async () => {
    setIsClearingQuestionBank(true);
    const authToken = token || 'admin_master_token_2026';
    try {
      let res = await fetch(apiUrl('/api/admin/questions/clear'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      // If POST /clear is not ok, fallback to DELETE /api/admin/questions
      if (!res.ok) {
        res = await fetch(apiUrl('/api/admin/questions'), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });
      }

      if (res.ok) {
        setQuestionBank([]);
        setQuestionBankSummary({ total: 0, availableCount: 0, usedCount: 0 });
        setIsConfirmClearBankOpen(false);
        fetchQuestions();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to clear question bank');
        setIsConfirmClearBankOpen(false);
      }
    } catch (err) {
      console.error('Failed to clear question bank:', err);
      // Fallback try DELETE
      try {
        const delRes = await fetch(apiUrl('/api/admin/questions'), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (delRes.ok) {
          setQuestionBank([]);
          setQuestionBankSummary({ total: 0, availableCount: 0, usedCount: 0 });
          setIsConfirmClearBankOpen(false);
          fetchQuestions();
          return;
        }
      } catch {
        // ignore
      }
      alert('Network error while clearing question bank');
      setIsConfirmClearBankOpen(false);
    } finally {
      setIsClearingQuestionBank(false);
    }
  };

  // Reset question sequence
  const handleResetQuestionSequence = async () => {
    const authToken = token || 'admin_master_token_2026';
    try {
      const res = await fetch(apiUrl('/api/admin/questions/reset-sequence'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        setIsConfirmResetSequenceOpen(false);
        fetchQuestions();
        alert('Question sequence reset! All questions are now eligible to be selected in random rounds again.');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to reset question sequence');
        setIsConfirmResetSequenceOpen(false);
      }
    } catch (err) {
      console.error('Failed to reset question sequence:', err);
      alert('Network error while resetting question sequence');
      setIsConfirmResetSequenceOpen(false);
    }
  };

  // Start round with random question from question bank
  const handleStartRandomRound = async () => {
    try {
      setEvaluationFeedback(null);
      const res = await startRandomRound();
      if (res) {
        fetchQuestions();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No questions available';
      alert(message);
    }
  };

  // Admin evaluation of contestant answer
  const handleEvaluateAnswer = async (contestantIndex: 0 | 1, result: 'correct' | 'wrong') => {
    setIsEvaluating(true);
    setEvaluationFeedback(null);
    try {
      const data = await evaluateAnswer(contestantIndex, result);
      if (data) {
        const contestant = contestants[contestantIndex];
        const points = result === 'correct' ? (contestantIndex === 0 ? 1000 : 700) : 0;
        setEvaluationFeedback(
          result === 'correct'
            ? `Marked Correct! Awarded ${points} Crypto to ${contestant.displayName}.`
            : `Marked Wrong. 0 points awarded to ${contestant.displayName}.`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Evaluation error';
      alert(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Reveal correct answer to audience/students
  const handleRevealAnswer = async () => {
    try {
      await revealAnswer();
    } catch (err) {
      console.error('Failed to reveal answer:', err);
    }
  };

  // Skip current question
  const handleSkipQuestion = async () => {
    if (!confirm('Are you sure you want to skip this question?')) return;
    try {
      await skipQuestion();
    } catch (err) {
      console.error('Failed to skip question:', err);
    }
  };

  // Toggle single student active/disabled
  const handleToggleStudentStatus = async (student: StudentItem) => {
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
    } catch (err) {
      console.error('Failed to update student:', err);
    }
  };

  // Reset student password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForPass || !newPassInput) return;

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
        alert('Password updated successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update password');
      }
    } catch {
      alert('Error updating password');
    }
  };

  // Create student account
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (res.ok) {
        setIsAddStudentOpen(false);
        setNewStudentForm({ displayName: '', studentId: '', email: '', password: '' });
        fetchStudents();
      } else {
        alert(data.error || 'Failed to add student');
      }
    } catch {
      alert('Error adding student');
    }
  };

  // CSV Import students
  const handleImportStudentsCsv = async () => {
    if (!csvInput.trim()) return;
    setCsvStatusMessage(null);
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
        fetchStudents();
        setCsvStatusMessage(`Successfully imported ${data.importedCount} student accounts.`);
        if (data.errors && data.errors.length > 0) {
          setCsvStatusMessage(
            `Imported ${data.importedCount} accounts. (${data.errors.length} rows skipped due to duplicates/missing data)`
          );
        }
      } else {
        setCsvStatusMessage(`Error: ${data.error || 'Failed to import CSV'}`);
      }
    } catch {
      setCsvStatusMessage('Network error uploading CSV');
    }
  };

  // Delete single student
  const handleDeleteStudent = async (student: StudentItem) => {
    if (!confirm(`Are you sure you want to remove student "${student.displayName}" (${student.studentId})?`)) return;
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/students/${student.uid}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchStudents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete student');
      }
    } catch (err) {
      console.error('Failed to delete student:', err);
    }
  };

  // Clear entire student list
  const handleClearList = async () => {
    if (students.length === 0) {
      alert('The student list is already empty.');
      return;
    }
    if (!confirm(`Warning: This will permanently remove all ${students.length} student account(s) from the roster list. Are you sure you want to proceed?`)) return;
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/admin/students'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchStudents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to clear student list');
      }
    } catch (err) {
      console.error('Failed to clear student list:', err);
    }
  };
  const handleClearAllStudents = handleClearList;

  // Create new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;

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
    window.location.href = apiUrl(
      `/api/admin/reports/${activeSessionId}/export-csv?token=${encodeURIComponent(token || '')}`
    );
  };

  // Filtered student list
  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.displayName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesFilter = studentFilter === 'all' ? true : s.accountStatus === studentFilter;
    return matchesSearch && matchesFilter;
  });

  // Filtered questions in Question Bank
  const filteredQuestions = questionBank.filter(q => {
    const matchesSearch =
      q.question.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.correctAnswer.toLowerCase().includes(questionSearch.toLowerCase());
    const matchesFilter =
      questionFilter === 'all'
        ? true
        : questionFilter === 'available'
        ? !q.usedInRoundId
        : Boolean(q.usedInRoundId);
    return matchesSearch && matchesFilter;
  });

  const connectedParticipantsCount = Object.values(participants).filter(p => p.isConnected).length;
  const isRoundOpen =
    currentRound?.status === 'OPEN' ||
    currentRound?.status === 'QUESTION_ACTIVE' ||
    (currentRound?.status === 'AWAITING_ANSWER_EVALUATION' && contestants.length < 2);

  // Status mapping
  const getRoundStatusDisplay = (status?: string) => {
    switch (status) {
      case 'QUESTION_ACTIVE':
      case 'OPEN':
        return { label: 'Question Active', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse' };
      case 'BUZZER_LOCKED':
        return { label: 'Buzzer Locked', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'AWAITING_ANSWER_EVALUATION':
        return { label: 'Awaiting Answer Evaluation', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse' };
      case 'ANSWER_CORRECT':
        return { label: 'Answer Correct', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'ANSWER_INCORRECT':
        return { label: 'Answer Incorrect', badge: 'bg-red-500/20 text-red-300 border-red-500/40' };
      case 'NEXT_CONTESTANT':
        return { label: 'Next Contestant', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse' };
      case 'QUESTION_COMPLETED':
        return { label: 'Question Completed', badge: 'bg-slate-700/50 text-slate-300 border-slate-600' };
      case 'ROUND_COMPLETED':
      case 'CLOSED':
        return { label: 'Round Completed', badge: 'bg-slate-800 text-slate-400 border-slate-700' };
      case 'WAITING_TO_START':
      case 'IDLE':
      default:
        return { label: 'Waiting to Start', badge: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  const statusDisplay = getRoundStatusDisplay(currentRound?.status);

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
                isProjectorMode ? 'bg-amber-500 text-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
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
                onClick={() => setActiveTab('questions')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors w-full ${
                  activeTab === 'questions'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4" />
                  <span>Question Bank</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeTab === 'questions' ? 'bg-black/30 text-white' : 'bg-slate-800 text-cyan-400'
                  }`}
                >
                  {questionBankSummary.availableCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors w-full ${
                  activeTab === 'leaderboard'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span>Leaderboard</span>
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
          {/* TAB: LIVE QUIZ */}
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

              {/* CURRENT QUESTION PROMINENT CARD & ROUND STATUS */}
              <div className="rounded-3xl border-2 border-slate-800 bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase text-cyan-400">
                      ROUND #{currentRound?.roundNumber || 1}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span
                      className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${statusDisplay.badge}`}
                    >
                      {statusDisplay.label}
                    </span>
                  </div>

                  {/* Available bank count badge */}
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {questionBankSummary.availableCount} Question{questionBankSummary.availableCount === 1 ? '' : 's'} Available
                    </span>
                  </div>
                </div>

                {/* Question Text */}
                <div className="my-4">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Question on Students&apos; Screens:
                  </span>
                  <p className="text-xl md:text-2xl font-bold text-white leading-relaxed">
                    {currentRound?.questionText || (
                      <span className="italic text-slate-500 font-normal">
                        No question currently loaded. Click &ldquo;Start Random Question&rdquo; below to pick from the Question Bank.
                      </span>
                    )}
                  </p>
                </div>

                {/* Admin-Only Answer Key Box */}
                {currentRound?.correctAnswer && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">
                          Protected Answer Key (Admin Host Only)
                        </span>
                        <span className="text-sm font-semibold text-white">{currentRound.correctAnswer}</span>
                      </div>
                    </div>

                    {!currentRound.isAnswerRevealed ? (
                      <button
                        onClick={handleRevealAnswer}
                        className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                        title="Reveal answer to students"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Reveal to Students</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-700/60">
                        Revealed to Students
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CONTESTANT ANSWER EVALUATION WORKFLOW PANEL */}
              {contestants.length > 0 && (
                <div className="bg-slate-900/90 border-2 border-purple-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                        Contestant Answer Evaluation Panel
                      </h3>
                    </div>

                    <span className="text-xs font-mono bg-purple-950 text-purple-300 px-3 py-1 rounded-full border border-purple-700">
                      Authoritative 2-Buzzer System
                    </span>
                  </div>

                  {evaluationFeedback && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{evaluationFeedback}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Contestant 1 Card */}
                    <div
                      className={`p-4 rounded-2xl border transition-all ${
                        currentRound?.activeContestantIndex === 0 && contestants[0]?.evaluation === 'pending'
                          ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-500/30'
                          : contestants[0]?.evaluation === 'correct'
                          ? 'bg-emerald-950/30 border-emerald-500/50'
                          : contestants[0]?.evaluation === 'wrong'
                          ? 'bg-red-950/30 border-red-500/50'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-cyan-500 text-black font-black flex items-center justify-center font-mono text-xs">
                            #1
                          </span>
                          <div>
                            <span className="text-sm font-bold text-white block">
                              {contestants[0].displayName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ID: {contestants[0].studentId}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                          {contestants[0].latencyMs} ms
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">Reward If Correct:</span>
                        <span className="font-mono font-bold text-cyan-300">+1,000 Crypto</span>
                      </div>

                      <div className="mt-2 text-xs font-mono">
                        {contestants[0].evaluation === 'correct' ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Correct (+1,000 Crypto Awarded)
                          </span>
                        ) : contestants[0].evaluation === 'wrong' ? (
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Incorrect (0 Crypto)
                          </span>
                        ) : (
                          <span className="text-purple-300 font-semibold animate-pulse">
                            Awaiting Host Decision...
                          </span>
                        )}
                      </div>

                      {/* Evaluation buttons for Contestant 1 */}
                      {currentRound?.activeContestantIndex === 0 && contestants[0].evaluation === 'pending' && (
                        <div className="mt-4 grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => handleEvaluateAnswer(0, 'correct')}
                            disabled={isEvaluating}
                            className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Mark Correct</span>
                          </button>
                          <button
                            onClick={() => handleEvaluateAnswer(0, 'wrong')}
                            disabled={isEvaluating}
                            className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md transition-all"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Mark Wrong</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Contestant 2 Card */}
                    {contestants[1] ? (
                      <div
                        className={`p-4 rounded-2xl border transition-all ${
                          currentRound?.activeContestantIndex === 1 && contestants[1]?.evaluation === 'pending'
                            ? 'bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/30'
                            : contestants[1]?.evaluation === 'correct'
                            ? 'bg-emerald-950/30 border-emerald-500/50'
                            : contestants[1]?.evaluation === 'wrong'
                            ? 'bg-red-950/30 border-red-500/50'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center font-mono text-xs">
                              #2
                            </span>
                            <div>
                              <span className="text-sm font-bold text-white block">
                                {contestants[1].displayName}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ID: {contestants[1].studentId}
                              </span>
                            </div>
                          </div>

                          <span className="text-xs font-mono text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                            {contestants[1].latencyMs} ms
                          </span>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-mono">Reward If Correct:</span>
                          <span className="font-mono font-bold text-indigo-300">+700 Crypto</span>
                        </div>

                        <div className="mt-2 text-xs font-mono">
                          {contestants[1].evaluation === 'correct' ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Correct (+700 Crypto Awarded)
                            </span>
                          ) : contestants[1].evaluation === 'wrong' ? (
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Incorrect (0 Crypto)
                            </span>
                          ) : currentRound?.activeContestantIndex === 1 ? (
                            <span className="text-indigo-300 font-semibold animate-pulse">
                              Now Answering! Host Decision Required
                            </span>
                          ) : (
                            <span className="text-slate-400">On Deck (Waiting for Contestant #1)</span>
                          )}
                        </div>

                        {/* Evaluation buttons for Contestant 2 */}
                        {currentRound?.activeContestantIndex === 1 && contestants[1].evaluation === 'pending' && (
                          <div className="mt-4 grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => handleEvaluateAnswer(1, 'correct')}
                              disabled={isEvaluating}
                              className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark Correct</span>
                            </button>
                            <button
                              onClick={() => handleEvaluateAnswer(1, 'wrong')}
                              disabled={isEvaluating}
                              className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md transition-all"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Mark Wrong</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-center text-xs text-slate-500">
                        <Users className="w-6 h-6 mb-1 text-slate-600" />
                        <span>No second contestant has buzzed yet.</span>
                        {isRoundOpen && <span className="text-cyan-400 mt-1 font-mono">Buzzer still accepts Contestant #2</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* HOST CONTROL ACTION BUTTONS */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 md:p-6 rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                      Quizmaster Round Controls
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select random questions, control buzzer state, or proceed through the competition.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Start Random Question Button */}
                    <button
                      onClick={handleStartRandomRound}
                      className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 cursor-pointer text-xs md:text-sm tracking-wide transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                      <span>START RANDOM QUESTION</span>
                    </button>

                    {/* Pause / Resume */}
                    {isRoundOpen ? (
                      <button
                        onClick={pauseRound}
                        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                        title="Lock buzzers temporarily"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      currentRound?.status === 'BUZZER_LOCKED' &&
                      contestants.length < 2 && (
                        <button
                          onClick={resumeRound}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                          title="Reopen buzzers"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </button>
                      )
                    )}

                    {/* Skip Question */}
                    <button
                      onClick={handleSkipQuestion}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                      title="Skip question without awarding points"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Skip</span>
                    </button>

                    {/* End Round */}
                    <button
                      onClick={endRound}
                      className="flex items-center gap-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                      title="End current round"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>End Round</span>
                    </button>
                  </div>
                </div>

                {/* Manual Question Override (Existing functionality preserved) */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={e => setQuestionInput(e.target.value)}
                    placeholder="Or type a custom question prompt manually..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => openRound(questionInput)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Open Custom Prompt
                  </button>
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
                        const isAccepted = att.status.includes('ACCEPTED');
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                              isAccepted
                                ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                                : 'bg-slate-950/60 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[11px] ${
                                  isAccepted ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {att.position || idx + 1}
                              </span>
                              <div>
                                <span className="font-bold block">{att.displayName}</span>
                                <span className="text-[11px] text-slate-400 font-mono">{att.studentId}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span
                                className={`font-mono font-bold block ${
                                  isAccepted ? 'text-cyan-400' : 'text-amber-400'
                                }`}
                              >
                                {att.status}
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

          {/* TAB: QUESTION BANK (NEW REQUIRED SECTION) */}
          {activeTab === 'questions' && !isProjectorMode && (
            <div className="space-y-6">
              {/* Question Bank Header & Summary */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-cyan-400" />
                    <span>Question Bank Management</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload questions and protected answer keys via CSV, preview validation, and manage the quiz question sequence.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setQuestionCsvText('');
                      setQuestionCsvPreview(null);
                      setQuestionCsvError(null);
                      setIsQuestionCsvModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer shadow-md transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload CSV Questions</span>
                  </button>

                  <button
                    onClick={() => setIsConfirmResetSequenceOpen(true)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                    title="Mark all questions as unused again without resetting student scores"
                  >
                    <RotateCcw className="w-4 h-4 text-cyan-400" />
                    <span>Reset Question Sequence</span>
                  </button>

                  <button
                    onClick={() => setIsConfirmClearBankOpen(true)}
                    className="flex items-center gap-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Question Bank</span>
                  </button>
                </div>
              </div>

              {/* Status Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-mono block">Total Questions</span>
                    <span className="text-xl font-black text-white font-mono">{questionBankSummary.total}</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-mono block">Available For Next Round</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      {questionBankSummary.availableCount}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-mono block">Used In Rounds</span>
                    <span className="text-xl font-black text-slate-300 font-mono">{questionBankSummary.usedCount}</span>
                  </div>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={questionSearch}
                    onChange={e => setQuestionSearch(e.target.value)}
                    placeholder="Search questions or answers..."
                    className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setQuestionFilter('all')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                      questionFilter === 'all' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({questionBank.length})
                  </button>
                  <button
                    onClick={() => setQuestionFilter('available')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                      questionFilter === 'available'
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Available ({questionBankSummary.availableCount})
                  </button>
                  <button
                    onClick={() => setQuestionFilter('used')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                      questionFilter === 'used' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Used ({questionBankSummary.usedCount})
                  </button>
                </div>
              </div>

              {/* Question Management Table */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                      <tr>
                        <th className="py-3 px-4 w-12">#</th>
                        <th className="py-3 px-4">Question Text</th>
                        <th className="py-3 px-4">Correct Answer Key</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredQuestions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-500 font-mono">
                            No questions found matching criteria. Upload a CSV to get started!
                          </td>
                        </tr>
                      ) : (
                        filteredQuestions.map((q, idx) => {
                          const isRevealed = revealedAnswerIds[q.id];
                          return (
                            <tr key={q.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-4">
                                <span className="font-medium text-slate-100 block max-w-lg leading-relaxed">
                                  {q.question}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-emerald-400 font-semibold">
                                    {isRevealed ? q.correctAnswer : '••••••••••••'}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setRevealedAnswerIds(prev => ({ ...prev, [q.id]: !prev[q.id] }))
                                    }
                                    className="text-slate-500 hover:text-slate-300 p-1"
                                    title={isRevealed ? 'Hide Answer' : 'Reveal Answer'}
                                  >
                                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {q.usedInRoundId ? (
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                    Used
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                                    Eligible for Round
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-400 transition-colors"
                                  title="Delete Question"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LEADERBOARD */}
          {activeTab === 'leaderboard' && !isProjectorMode && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span>Real-Time Contestant Leaderboard</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Deterministic tie-breaking based on earliest timestamp reached. Updates dynamically upon admin answer evaluation.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
                <LeaderboardView entries={leaderboard} />
              </div>
            </div>
          )}

          {/* TAB: STUDENTS MANAGEMENT (Preserved) */}
          {activeTab === 'students' && !isProjectorMode && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">Student Account Management</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage authorized contestant accounts, import student lists via CSV, and reset passwords.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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
                    <span>Import Student CSV</span>
                  </button>
                  <button
                    onClick={handleClearList}
                    className="flex items-center gap-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-300 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                    title="Remove all students from the list"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear List</span>
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
                      studentFilter === 'active' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Active ({students.filter(s => s.accountStatus === 'active').length})
                  </button>
                  <button
                    onClick={() => setStudentFilter('disabled')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                      studentFilter === 'disabled' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
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

                                <button
                                  onClick={() => handleDeleteStudent(student)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-400 transition-colors"
                                  title="Delete Student Account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

          {/* TAB: SESSIONS (Preserved) */}
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
                            className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300"
                          >
                            Set As Active →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: REPORTS (Preserved) */}
          {activeTab === 'reports' && !isProjectorMode && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Competition Audit & CSV Export</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Download complete round logs including millisecond timestamps, student USNs, and evaluation results.
                  </p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Session CSV</span>
                </button>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-slate-200">Export Scope:</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  The generated report contains row-level details for every round:
                  <br />• Session Title & Session PIN
                  <br />• Round Number & Question Text
                  <br />• Authoritative Winner Name & USN
                  <br />• Timestamp & Latency (ms)
                  <br />• Total Buzzer Submissions per round
                </p>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS (Preserved) */}
          {activeTab === 'settings' && !isProjectorMode && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white">Platform Settings & Security</h2>
                <p className="text-xs text-slate-400 mt-1">Authoritative configuration and system info.</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">System Architecture</h3>
                    <p className="text-xs text-slate-400">
                      Authoritative in-memory Store with disk persistence and Realtime Server-Sent Events (SSE).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CSV QUESTION UPLOAD & PREVIEW MODAL */}
      {isQuestionCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Upload Question Bank CSV</h3>
              </div>
              <button
                onClick={() => setIsQuestionCsvModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Format Guide */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                <span className="font-mono text-cyan-400 font-bold block mb-1">Required CSV Format:</span>
                <code className="text-slate-300 font-mono text-[11px] block bg-slate-900 p-2 rounded">
                  question,correct_answer
                  <br />
                  &quot;What is the capital of Karnataka?&quot;,&quot;Bengaluru&quot;
                  <br />
                  &quot;Which language is used to build React applications?&quot;,&quot;JavaScript&quot;
                </code>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Supports UTF-8 BOM, quoted fields with internal commas, quotes, and custom spacing.
                </span>
              </div>

              {/* File Input and Textarea */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Choose .csv File or Paste Content:
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 mb-3"
                />

                <textarea
                  rows={5}
                  value={questionCsvText}
                  onChange={e => {
                    setQuestionCsvText(e.target.value);
                    handlePreviewQuestionCsv(e.target.value);
                  }}
                  placeholder='question,correct_answer&#10;"What does CPU stand for?","Central Processing Unit"'
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Validation Errors Callout */}
              {questionCsvPreview && questionCsvPreview.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs space-y-1">
                  <span className="font-bold text-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Validation Issues Detected:
                  </span>
                  {questionCsvPreview.errors.map((err, idx) => (
                    <p key={idx} className="text-red-300/90 font-mono text-[11px]">
                      • {err}
                    </p>
                  ))}
                </div>
              )}

              {/* Preview Table */}
              {questionCsvPreview && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
                  <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 font-bold">
                      Detected: {questionCsvPreview.totalDetected} Row{questionCsvPreview.totalDetected === 1 ? '' : 's'}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      Valid: {questionCsvPreview.validCount}
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono uppercase">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Question</th>
                          <th className="py-2 px-3">Correct Answer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {questionCsvPreview.preview.map((q, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 text-slate-200">{q.question}</td>
                            <td className="py-2 px-3 font-mono text-emerald-400 font-bold">{q.correctAnswer}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {questionCsvError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 p-2.5 rounded-xl">
                  {questionCsvError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsQuestionCsvModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleImportQuestionCsv}
                disabled={isQuestionCsvLoading || !questionCsvPreview || questionCsvPreview.validCount === 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isQuestionCsvLoading
                  ? 'Importing...'
                  : `Confirm & Import ${questionCsvPreview?.validCount || 0} Questions`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR QUESTION BANK MODAL */}
      {isConfirmClearBankOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-2">Clear Question Bank?</h3>
            <p className="text-xs text-slate-400 mb-6">
              This will remove all questions from the question bank. Existing student scores and completed rounds will be preserved.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmClearBankOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingQuestionBank}
                onClick={handleClearQuestionBank}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 cursor-pointer transition-colors shadow-lg shadow-red-600/20"
              >
                {isClearingQuestionBank ? 'Clearing...' : 'Confirm Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM RESET SEQUENCE MODAL */}
      {isConfirmResetSequenceOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
            <RotateCcw className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-2">Reset Question Sequence?</h3>
            <p className="text-xs text-slate-400 mb-6">
              This will mark all questions in the bank as eligible for upcoming rounds again. Student scores and leaderboard standings will NOT be erased.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setIsConfirmResetSequenceOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleResetQuestionSequence}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
              >
                Reset Sequence
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Student Modal (Existing preserved) */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Add Contestant Account</h3>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.displayName}
                  onChange={e => setNewStudentForm({ ...newStudentForm, displayName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Student ID / USN</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.studentId}
                  onChange={e => setNewStudentForm({ ...newStudentForm, studentId: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newStudentForm.email}
                  onChange={e => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newStudentForm.password}
                  onChange={e => setNewStudentForm({ ...newStudentForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Students Modal (Existing preserved) */}
      {isCsvImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Bulk Import Contestants (CSV)</h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Header format: Name,Student ID,Email,Password
            </p>
            <textarea
              rows={6}
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
              placeholder="Name,Student ID,Email,Password&#10;Alex Turner,1MS21CS042,alex@campus.edu,secret123"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 outline-none mb-3"
            />
            {csvStatusMessage && (
              <div className="text-xs text-cyan-300 font-mono mb-3 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-800/40">
                {csvStatusMessage}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsCsvImportOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleImportStudentsCsv}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
              >
                Import Accounts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Student Password Modal (Existing preserved) */}
      {isResetPassOpen && selectedStudentForPass && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Reset Password</h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              For: {selectedStudentForPass.displayName} ({selectedStudentForPass.studentId})
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassInput}
                  onChange={e => setNewPassInput(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsResetPassOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Session Modal (Existing preserved) */}
      {isNewSessionOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Create New Session</h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  value={newSessionTitle}
                  onChange={e => setNewSessionTitle(e.target.value)}
                  placeholder="e.g. Finals Round 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Custom Code (Optional)
                </label>
                <input
                  type="text"
                  value={newSessionCode}
                  onChange={e => setNewSessionCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BUZZ99"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewSessionOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
