'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  loginWithEmailApi,
  loginWithGoogleApi,
  refreshTokenApi,
  logoutApi,
  type AuthUser,
} from '@/lib/api';
import { createAuthClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;       // true while restoring session on mount
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (googleIdToken: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Authenticated fetch: injects Bearer token, retries once after silent refresh on 401. */
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateProfile: (data: { name?: string | null; avatar?: string | null }) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_CACHE_KEY = 'jireh_user';

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser) {
  try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)); } catch { /* ignore */ }
}

function clearCachedUser() {
  try { localStorage.removeItem(USER_CACHE_KEY); } catch { /* ignore */ }
}

function parseTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // seconds → ms
  } catch {
    return 0;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Access token lives in a ref (in-memory, never touches localStorage/sessionStorage).
  // State is only for the user object (drives re-renders).
  const tokenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Deduplicates concurrent refresh calls — all callers share the same promise.
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  // Stable ref so scheduleRefresh can call doRefresh without a circular useCallback dep.
  const doRefreshRef = useRef<() => Promise<string | null>>(() => Promise.resolve(null));

  // ── Internal helpers (plain functions — only read/write refs and stable setters) ──

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function scheduleRefresh(token: string) {
    clearTimer();
    // Refresh 60 s before expiry; minimum 10 s to avoid tight loops.
    const delay = Math.max(parseTokenExpiry(token) - Date.now() - 60_000, 10_000);
    timerRef.current = setTimeout(() => doRefreshRef.current(), delay);
  }

  function applyAuth(token: string, userData: AuthUser) {
    tokenRef.current = token;
    writeCachedUser(userData);
    setUser(userData);
    setIsLoading(false);
    scheduleRefresh(token);
  }

  function clearAuth() {
    clearTimer();
    clearCachedUser();
    tokenRef.current = null;
    setUser(null);
  }

  // ── Core refresh logic ────────────────────────────────────────────────────

  const doRefresh = useCallback((): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const { accessToken } = await refreshTokenApi();

        // Fetch full user info with the new token
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!meRes.ok) throw new Error('Failed to load user');

        const { user: userData }: { user: AuthUser } = await meRes.json();
        applyAuth(accessToken, userData);
        return accessToken;
      } catch {
        clearTimer();
        clearCachedUser();
        tokenRef.current = null;
        // Keep user state visible during the redirect transition — the redirect
        // effect fires on the next render when isAuthenticated becomes false.
        setUser(null);
        setIsLoading(false);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the ref up to date so scheduleRefresh always invokes the latest version
  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  // ── Session restore on mount ──────────────────────────────────────────────

  useEffect(() => {
    // Show cached user immediately so the UI renders without waiting for the network
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setIsLoading(false);
    }
    // Always validate in the background — clears cache and redirects if cookie is gone
    doRefresh();
    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const loginWithEmail = useCallback(async (email: string, password: string, rememberMe = false) => {
    const { accessToken, user: userData } = await loginWithEmailApi(email, password, rememberMe);
    applyAuth(accessToken, userData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithGoogle = useCallback(async (googleIdToken: string) => {
    const { accessToken, user: userData } = await loginWithGoogleApi(googleIdToken);
    applyAuth(accessToken, userData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    clearAuth();
    await logoutApi().catch(() => null); // best-effort — cookie is cleared server-side
    router.push('/login');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const sendPasswordReset = useCallback(async (email: string) => {
    const supabase = createAuthClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  }, []);

  /**
   * Drop-in replacement for fetch() for authenticated endpoints.
   * Automatically injects the Bearer token and retries once if the server
   * returns 401 (e.g., token expired between the schedule and the call).
   */
  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = (token: string) =>
        fetch(input, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
            Authorization: `Bearer ${token}`,
          },
        });

      // No token in memory → try to refresh before the request
      if (!tokenRef.current) {
        const newToken = await doRefresh();
        if (!newToken) {
          router.push('/login');
          throw new Error('Unauthorized');
        }
        return request(newToken);
      }

      const res = await request(tokenRef.current);

      // Token was valid in memory but rejected by server → refresh and retry once
      if (res.status === 401) {
        const newToken = await doRefresh();
        if (!newToken) {
          router.push('/login');
          throw new Error('Session expired');
        }
        return request(newToken);
      }

      return res;
    },
    // doRefresh is stable (useCallback with no deps that change); router is stable
    [doRefresh, router]
  );

  const updateProfile = useCallback(async (data: { name?: string | null; avatar?: string | null }) => {
    const payload: Record<string, string | null> = {};
    if (data.name !== undefined) payload.full_name = data.name;
    if (data.avatar !== undefined) payload.avatar_url = data.avatar;

    const res = await authFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error ?? 'Failed to update profile');
    }

    setUser(prev => {
      if (!prev) return prev;
      const updated: AuthUser = {
        ...prev,
        name: data.name !== undefined ? data.name : prev.name,
        avatar: data.avatar !== undefined ? data.avatar : prev.avatar,
      };
      writeCachedUser(updated);
      return updated;
    });
  }, [authFetch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        loginWithEmail,
        loginWithGoogle,
        logout,
        authFetch,
        sendPasswordReset,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
