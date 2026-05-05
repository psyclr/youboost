'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { createStripeCheckout, createCryptomusCheckout } from '@/lib/api/billing';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { ArrowLeft, CreditCard, Bitcoin } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const depositSchema = z.object({
  amount: z.number().min(5, 'Minimum deposit is $5').max(10_000, 'Maximum deposit is $10,000'),
});

type DepositForm = z.infer<typeof depositSchema>;

export default function DepositPage() {
  const stripeForm = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 25 },
  });

  const cryptoForm = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 25 },
  });

  const stripeMutation = useMutation({
    mutationFn: (data: DepositForm) => createStripeCheckout(data.amount),
    onSuccess: (data) => {
      try {
        const url = new URL(data.url);
        if (url.hostname === 'checkout.stripe.com' || url.hostname.endsWith('.stripe.com')) {
          globalThis.location.href = data.url;
        } else {
          toast.error('Invalid payment URL received. Please try again.');
        }
      } catch {
        toast.error('Invalid payment URL format. Please try again.');
      }
    },
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to create checkout session');
    },
  });

  const cryptoMutation = useMutation({
    mutationFn: (data: DepositForm) => createCryptomusCheckout(data.amount),
    onSuccess: (data) => {
      try {
        const url = new URL(data.url);
        if (url.hostname.endsWith('cryptomus.com')) {
          globalThis.location.href = data.url;
        } else {
          toast.error('Invalid payment URL received. Please try again.');
        }
      } catch {
        toast.error('Invalid payment URL format. Please try again.');
      }
    },
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to create crypto checkout');
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/billing">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Deposit Funds</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pay with Card
            </CardTitle>
            <CardDescription>Visa, Mastercard, Apple Pay, Google Pay</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...stripeForm}>
              <form
                onSubmit={stripeForm.handleSubmit((data) => stripeMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={stripeForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={5}
                          max={10000}
                          step={1}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.valueAsNumber;
                            field.onChange(Number.isNaN(v) ? undefined : v);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>Min: $5 — Max: $10,000</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => stripeForm.setValue('amount', amount)}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={stripeMutation.isPending}>
                  {stripeMutation.isPending
                    ? 'Redirecting…'
                    : `Pay $${stripeForm.watch('amount')?.toFixed(2) ?? '0.00'}`}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bitcoin className="h-5 w-5" />
              Pay with Crypto
            </CardTitle>
            <CardDescription>USDT, BTC, ETH and other cryptocurrencies</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...cryptoForm}>
              <form
                onSubmit={cryptoForm.handleSubmit((data) => cryptoMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={cryptoForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (USD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={5}
                          max={10000}
                          step={1}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.valueAsNumber;
                            field.onChange(Number.isNaN(v) ? undefined : v);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>Min: $5 — Max: $10,000</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cryptoForm.setValue('amount', amount)}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={cryptoMutation.isPending}>
                  {cryptoMutation.isPending
                    ? 'Redirecting…'
                    : `Pay $${cryptoForm.watch('amount')?.toFixed(2) ?? '0.00'} in Crypto`}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
