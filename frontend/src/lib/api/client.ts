import type { ZodType } from 'zod';
import { ZodError } from 'zod';
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
      ...(options?.headers as Record<string, string>),
    };

    // Only declare a JSON body when one is actually sent. A bodyless POST (e.g.
    // /auth/logout) with `Content-Type: application/json` makes Fastify's JSON
    // parser reject the empty body with FST_ERR_CTP_EMPTY_JSON_BODY (500).
    if (options?.body != null) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      // Send the httpOnly auth cookie along on the same-origin /api proxy.
      credentials: 'same-origin',
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

/**
 * Like apiRequest, but validates the response against a zod schema at runtime.
 * Reserved for MONEY-CRITICAL responses (balances, prices, checkout URLs): a
 * backend/frontend contract drift fails closed with a clear error instead of
 * silently rendering NaN/undefined totals. Schemas are loose (passthrough), so
 * only the money fields the UI renders are validated — extra/new backend fields
 * never throw.
 */
export async function apiRequestValidated<T>(
  path: string,
  schema: ZodType,
  options?: RequestInit,
): Promise<T> {
  const data = await rawRequest(path, options);
  try {
    // Schemas are a loose money SUBSET of the response, so the parsed shape is
    // narrower than T (it omits non-money fields). The cast restores the full
    // response type — only the money fields the UI renders are guaranteed valid.
    return schema.parse(data) as T;
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError('INVALID_RESPONSE', 'Unexpected server response', 502, err.issues);
    }
    throw err;
  }
}
