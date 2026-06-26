'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setAuthHandlers } from '@/lib/api/client';
import * as authApi from '@/lib/api/auth';
import type { UserProfile } from '@/lib/api/types';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  refreshProfile: () => void;
  setSession: (tokens: { accessToken: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Legacy localStorage key from the pre-cookie scheme. Refresh tokens now live in
// an httpOnly cookie set by the backend; this key is only cleared on bootstrap.
const LEGACY_REFRESH_TOKEN_KEY = 'youboost_refresh_token';

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  const clearAuth = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    // The httpOnly cookie (if any) drives the refresh; no client-side token to
    // gate on. A 200 with an access token means we have a live session.
    const tokens = await authApi.refreshToken();
    if (tokens) {
      accessTokenRef.current = tokens.accessToken;
      return tokens.accessToken;
    }
    clearAuth();
    return null;
  }, [clearAuth]);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  // Register auth handlers with the API client
  useEffect(() => {
    setAuthHandlers(getAccessToken, doRefresh, clearAuth);
  }, [getAccessToken, doRefresh, clearAuth]);

  // Initialize auth on mount
  useEffect(() => {
    const init = async () => {
      // One-time cleanup of the stale localStorage key from the old scheme.
      localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
      const token = await doRefresh();
      if (token) {
        try {
          const profile = await authApi.getMe();
          setUser(profile);
        } catch {
          clearAuth();
        }
      }
      setIsLoading(false);
    };
    init();
  }, [doRefresh, clearAuth]);

  const login = useCallback(async (email: string, password: string) => {
    // The backend sets the httpOnly refresh cookie; we only keep the access
    // token in memory.
    const tokens = await authApi.login({ email, password });
    accessTokenRef.current = tokens.accessToken;
    const profile = await authApi.getMe();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    }
    clearAuth();
  }, [clearAuth]);

  const setSession = useCallback(async (tokens: { accessToken: string }) => {
    // Used by the Google OAuth callback. The refresh cookie is already set by
    // the backend; only the access token reaches the client.
    accessTokenRef.current = tokens.accessToken;
    const profile = await authApi.getMe();
    setUser(profile);
  }, []);

  const refreshProfile = useCallback(() => {
    authApi
      .getMe()
      .then(setUser)
      .catch(() => {});
  }, []);

  const contextValue = useMemo(
    () => ({ user, isLoading, login, logout, getAccessToken, refreshProfile, setSession }),
    [user, isLoading, login, logout, getAccessToken, refreshProfile, setSession],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
