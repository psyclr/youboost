'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function GoogleCallbackPage() {
  const { setSession } = useAuth();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
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
      router.replace('/login?error=google');
      return;
    }

    setSession({ accessToken, refreshToken })
      .then(() => router.replace('/dashboard'))
      .catch(() => {
        setFailed(true);
        router.replace('/login?error=google');
      });
  }, [setSession, router]);

  return (
    <p className="text-sm text-muted-foreground" role="status">
      {failed ? 'Sign-in failed, redirecting…' : 'Completing sign-in…'}
    </p>
  );
}
