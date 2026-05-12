import { apiRequest } from './client';
import type { LoginInput, RegisterInput, TokenPair, UserProfile } from './types';

export const login = (data: LoginInput) =>
  apiRequest<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const register = (data: RegisterInput) =>
  apiRequest<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const refreshToken = (refreshToken: string) =>
  apiRequest<TokenPair>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

export const getMe = () => apiRequest<UserProfile>('/auth/me');

export const logout = () => apiRequest<void>('/auth/logout', { method: 'POST' });

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
