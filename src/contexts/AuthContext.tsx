import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '../types/quiz.js';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  joinedSessionId: string | null;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  quickJoinStudent: (name: string, sessionPin: string, studentId?: string) => Promise<{ success: boolean; error?: string; sessionId?: string }>;
  logout: () => Promise<void>;
  updateUserSnapshot: (updated: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('qb_token') || null;
    } catch {
      return null;
    }
  });
  const [joinedSessionId, setJoinedSessionId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('qb_session_id') || 'ses_main_2026';
    } catch {
      return 'ses_main_2026';
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          setToken(null);
          setUser(null);
          sessionStorage.removeItem('qb_token');
        }
      } catch {
        // Network issue, keep token to retry
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [token]);

  const quickJoinStudent = async (
    name: string,
    sessionPin: string,
    studentId?: string
  ): Promise<{ success: boolean; error?: string; sessionId?: string }> => {
    try {
      const res = await fetch('/api/sessions/quick-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sessionPin, studentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to join session' };
      }

      setToken(data.token);
      setUser(data.user);
      if (data.session?.sessionId) {
        setJoinedSessionId(data.session.sessionId);
        try {
          sessionStorage.setItem('qb_session_id', data.session.sessionId);
        } catch {
          // ignore
        }
      }
      try {
        sessionStorage.setItem('qb_token', data.token);
      } catch {
        // ignore
      }
      return { success: true, sessionId: data.session?.sessionId };
    } catch {
      return { success: false, error: 'Network connection failed' };
    }
  };

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Authentication failed' };
      }

      setToken(data.token);
      setUser(data.user);
      try {
        sessionStorage.setItem('qb_token', data.token);
      } catch {
        // ignore
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network connection failed' };
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    setToken(null);
    setUser(null);
    try {
      sessionStorage.removeItem('qb_token');
    } catch {
      // ignore
    }
  };

  const updateUserSnapshot = (updated: Partial<UserProfile>) => {
    if (user) {
      setUser({ ...user, ...updated });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        joinedSessionId,
        login,
        quickJoinStudent,
        logout,
        updateUserSnapshot,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
