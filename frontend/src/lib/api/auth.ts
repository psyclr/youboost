import { apiRequest, apiRequestVoid } from './client';
import type { LoginInput, RegisterInput, UserProfile } from './types';

/**
 * Auth responses no longer carry a refresh token: the backend issues it as an
 * httpOnly `youboost_rt` cookie. Only the in-memory access token is returned.
 */
export interface AccessTokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export const login = (data: LoginInput) =>
  apiRequest<AccessTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const register = (data: RegisterInput) =>
  apiRequest<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/**
 * Refreshes the access token using the httpOnly `youboost_rt` cookie (no body).
 *
 * Deliberately uses a direct `fetch` rather than the shared `apiRequest`: the
 * client's `rawRequest` retries 401s by calling the refresh handler, so routing
 * the refresh through it would let a 401 from `/auth/refresh` re-enter the
 * in-flight refresh promise — a promise awaiting itself — and hang. The cookie
 * rides along on the same-origin proxy via `credentials: 'same-origin'`.
 */
export const refreshToken = async (): Promise<AccessTokenResponse | null> => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) return null;
  return (await response.json()) as AccessTokenResponse;
};

export const getMe = () => apiRequest<UserProfile>('/auth/me');

export const logout = () => apiRequestVoid('/auth/logout', { method: 'POST' });

export const forgotPassword = (email: string) =>
  apiRequest<{ success: boolean }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token: string, newPassword: string) =>
  apiRequest<{ success: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });

export const verifyResetToken = (token: string) =>
  apiRequest<{ valid: boolean }>('/auth/verify-reset-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const verifyEmail = (token: string) =>
  apiRequest<{ success: boolean }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const setPassword = (body: { token: string; newPassword: string }) =>
  apiRequest<{ userId: string }>('/auth/set-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateProfile = (data: {
  username?: string;
  currentPassword?: string;
  newPassword?: string;
}) =>
  apiRequest<UserProfile>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
