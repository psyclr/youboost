'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthPageSkeleton } from '@/components/auth/auth-page-skeleton';
import { ROUTES } from '@/lib/constants/routes';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  // A missing token is known at first render — start in the error state
  // instead of transitioning to it from the effect.
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    token ? 'loading' : 'error',
  );
  const [error, setError] = useState<string | null>(
    token ? null : 'Invalid verification link. No token provided.',
  );

  useEffect(() => {
    if (!token) return;

    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verifying Email</CardTitle>
          <CardDescription>Please wait while we verify your email address...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verification Failed</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href={ROUTES.login} className="text-sm text-primary hover:underline">
            Go to Sign In
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Verified</CardTitle>
        <CardDescription>
          Your email has been verified successfully. You can now sign in.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-center">
        <Link href={ROUTES.login} className="text-sm text-primary hover:underline">
          Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
