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
