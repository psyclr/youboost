'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
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

const setPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/\d/, 'Must contain a digit'),
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

  const mutation = useMutation({
    mutationFn: (data: SetPasswordForm) =>
      setPassword({ token: token ?? '', newPassword: data.newPassword }),
    onSuccess: () => {
      router.push('/login?setupDone=1');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setError(errorMessage(err.code));
      } else {
        setError('Something went wrong. Try again.');
      }
    },
  });

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid Link</CardTitle>
          <CardDescription>This link is invalid. Request a new one.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/" className="text-sm text-primary hover:underline">
            Back to Home
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const onSubmit = (data: SetPasswordForm) => {
    setError(null);
    mutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Password</CardTitle>
        <CardDescription>Create a password to finish activating your account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
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
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Setting Password…' : 'Set Password'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordFormContent />
    </Suspense>
  );
}
