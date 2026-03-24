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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_TOKEN_KEY = 'youboost_refresh_token';

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  const clearAuth = useCallback(() => {
    accessTokenRef.current = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefresh) return null;

    try {
      const tokens = await authApi.refreshToken(storedRefresh);
      accessTokenRef.current = tokens.accessToken;
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      clearAuth();
      return null;
    }
  }, [clearAuth]);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  // Register auth handlers with the API client
  useEffect(() => {
    setAuthHandlers(getAccessToken, doRefresh, clearAuth);
  }, [getAccessToken, doRefresh, clearAuth]);

  // Initialize auth on mount
  useEffect(() => {
    const init = async () => {
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
    const tokens = await authApi.login({ email, password });
    accessTokenRef.current = tokens.accessToken;
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
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

  const refreshProfile = useCallback(() => {
    authApi
      .getMe()
      .then(setUser)
      .catch(() => {});
  }, []);

  const contextValue = useMemo(
    () => ({ user, isLoading, login, logout, getAccessToken, refreshProfile }),
    [user, isLoading, login, logout, getAccessToken, refreshProfile],
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
