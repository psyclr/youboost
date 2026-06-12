'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  ROUTES,
  OAUTH_ERROR_QUERY_PARAM,
  GOOGLE_OAUTH_ERROR,
} from '@/lib/constants/routes';

const GOOGLE_ERROR_REDIRECT = `${ROUTES.login}?${OAUTH_ERROR_QUERY_PARAM}=${GOOGLE_OAUTH_ERROR}`;

export default function GoogleCallbackPage() {
  const { setSession } = useAuth();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    // Strip tokens from the URL so they don't linger in history.
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken || !refreshToken) {
      router.replace(GOOGLE_ERROR_REDIRECT);
      return;
    }

    setSession({ accessToken, refreshToken })
      .then(() => router.replace(ROUTES.dashboard))
      .catch(() => {
        router.replace(GOOGLE_ERROR_REDIRECT);
      });
  }, [setSession, router]);

  return (
    <p className="text-sm text-muted-foreground" role="status">
      Completing sign-in…
    </p>
  );
}
