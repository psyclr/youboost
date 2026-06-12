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

// Deduplicates concurrent token refreshes. The backend rotates refresh tokens
// (the old one is revoked when a new pair is issued), so N requests hitting 401
// at once must share a single refresh — parallel refreshes would race and the
// losers would wipe a live session.
let refreshPromise: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function setAuthHandlers(
  accessor: TokenAccessor,
  refresher: TokenRefresher,
  onFailure: LogoutHandler,
) {
  getAccessToken = accessor;
  refreshAccessToken = refresher;
  onAuthFailure = onFailure;
  refreshPromise = null;
}

const BASE_URL = '/api';

async function rawRequest(path: string, options?: RequestInit): Promise<unknown> {
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
    const newToken = await refreshOnce();
    if (newToken) {
      response = await doFetch(newToken);
    } else {
      onAuthFailure();
      throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
    }
  }

  if (response.status === 204) {
    return undefined;
  }

  const data: unknown = await response.json();

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new ApiError(
      errorData.error?.code || 'UNKNOWN_ERROR',
      errorData.error?.message || 'An error occurred',
      response.status,
      errorData.error?.details,
    );
  }

  return data;
}

export function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  // The cast is trusted: responses come from our own backend and are not
  // schema-validated at runtime.
  return rawRequest(path, options) as Promise<T>;
}

/** For endpoints that respond with no content (e.g. DELETE -> 204). */
export async function apiRequestVoid(path: string, options?: RequestInit): Promise<void> {
  await rawRequest(path, options);
}
