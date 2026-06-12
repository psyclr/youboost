'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { setPassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AuthErrorBanner } from '@/components/auth/auth-error-banner';
import { AuthPageSkeleton } from '@/components/auth/auth-page-skeleton';
import { strongPasswordSchema } from '@/lib/validation/password';
import { ROUTES } from '@/lib/constants/routes';

const setPasswordSchema = z
  .object({
    newPassword: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SetPasswordForm = z.infer<typeof setPasswordSchema>;

const errorMessage = (code: string): string => {
  switch (code) {
    case 'INVALID_SETUP_TOKEN':
      return 'This link is invalid. Request a new one.';
    case 'SETUP_TOKEN_USED':
      return 'This link was already used. Try logging in.';
    case 'SETUP_TOKEN_EXPIRED':
      return 'This link has expired. Request a new one.';
    case 'VALIDATION_ERROR':
      return 'Please check the password requirements and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
};

function SetPasswordFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid Link</CardTitle>
          <CardDescription>This link is invalid. Request a new one.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href={ROUTES.home} className="text-sm text-primary hover:underline">
            Back to Home
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const onSubmit = async (data: SetPasswordForm) => {
    setError(null);
    try {
      await setPassword({ token, newPassword: data.newPassword });
      router.push(ROUTES.login);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(errorMessage(err.code));
      } else {
        setError('Something went wrong. Try again.');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Password</CardTitle>
        <CardDescription>Create a password to finish activating your account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && <AuthErrorBanner message={error} />}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Create a strong password"
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Confirm your password"
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Setting Password…' : 'Set Password'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link href={ROUTES.login} className="text-sm text-primary hover:underline">
          Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <SetPasswordFormContent />
    </Suspense>
  );
}
