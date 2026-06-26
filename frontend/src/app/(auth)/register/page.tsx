'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { register as registerApi } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/error-messages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { GoogleButton } from '@/components/auth/google-button';
import { AuthErrorBanner } from '@/components/auth/auth-error-banner';
import { AuthPageSkeleton } from '@/components/auth/auth-page-skeleton';
import { strongPasswordSchema } from '@/lib/validation/password';
import { ROUTES } from '@/lib/constants/routes';

// Fast sign-up: only email + password. The backend derives everything else
// (login is by email; no username to pick).
const registerSchema = z.object({
  email: z.email('Invalid email address'),
  password: strongPasswordSchema,
});

type RegisterForm = z.infer<typeof registerSchema>;

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') ?? '';
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    try {
      await registerApi({
        email: data.email,
        password: data.password,
        referralCode: refCode || undefined,
      });
      router.push(ROUTES.login);
    } catch (err) {
      setError(getErrorMessage(err, 'An unexpected error occurred'));
    }
  };

  return (
    // Full-screen overlay so the wide two-panel card escapes the shared (auth)
    // layout's narrow max-w-md wrapper without affecting the other auth pages.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-100">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 md:grid-cols-2">
        {/* Left visual panel — hidden on mobile */}
        <div className="relative hidden min-h-[520px] items-center justify-center overflow-hidden bg-neutral-900 md:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(600px 500px at 40% 60%, rgba(255,0,0,0.30) 0%, rgba(255,0,0,0) 60%)',
            }}
          />
          <Image
            src="/brand/hero-play-3d.png"
            alt=""
            width={360}
            height={426}
            priority
            className="relative h-auto w-[78%] max-w-[360px] select-none"
            style={{ filter: 'drop-shadow(0 30px 60px rgba(255,0,0,0.35))' }}
          />
        </div>

        {/* Right form panel */}
        <div className="px-7 py-10 text-neutral-900 sm:px-10">
          <h1 className="mb-8 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Seconds to sign up!
          </h1>
          <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {error && <AuthErrorBanner message={error} />}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[15px] font-semibold text-neutral-900">
                      Login / Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your login / email"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        className="h-12 bg-neutral-50 text-neutral-900"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[15px] font-semibold text-neutral-900">
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter password"
                        type="password"
                        autoComplete="new-password"
                        className="h-12 bg-neutral-50 text-neutral-900"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-12 w-full bg-red-600 text-base font-semibold text-white hover:bg-red-700"
              >
                {form.formState.isSubmitting ? 'Creating account…' : 'Registration'}
              </Button>
              <GoogleButton label="Log in with a Google account" />
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-neutral-500">
            <Link href={ROUTES.login} className="font-medium text-neutral-700 hover:underline">
              Do you already have an account?
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <RegisterFormContent />
    </Suspense>
  );
}
