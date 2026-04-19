import type { ApiErrorResponse } from './types';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenAccessor = () => string | null;
type TokenRefresher = () => Promise<string | null>;
type LogoutHandler = () => void;

let getAccessToken: TokenAccessor = () => null;
let refreshAccessToken: TokenRefresher = async () => null;
let onAuthFailure: LogoutHandler = () => {};

export function setAuthHandlers(
  accessor: TokenAccessor,
  refresher: TokenRefresher,
  onFailure: LogoutHandler,
) {
  getAccessToken = accessor;
  refreshAccessToken = refresher;
  onAuthFailure = onFailure;
}

const BASE_URL = '/api';

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    return response;
  };

  const token = getAccessToken();
  let response = await doFetch(token);

  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch(newToken);
    } else {
      onAuthFailure();
      throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new ApiError(
      errorData.error?.code || 'UNKNOWN_ERROR',
      errorData.error?.message || 'An error occurred',
      response.status,
      errorData.error?.details,
    );
  }

  return data as T;
}
