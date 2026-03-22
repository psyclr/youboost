'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDeposit, confirmDeposit, createStripeCheckout } from '@/lib/api/billing';
import { ApiError } from '@/lib/api/client';
import type { DepositResponse } from '@/lib/api/types';
import { formatCurrency } from '@/lib/utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Copy, ArrowLeft, CreditCard, Bitcoin } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const cryptoDepositSchema = z.object({
  amount: z.number().min(10, 'Minimum deposit is $10'),
  cryptoCurrency: z.enum(['USDT', 'BTC', 'ETH']),
});

const stripeDepositSchema = z.object({
  amount: z.number().min(5, 'Minimum deposit is $5').max(10_000, 'Maximum deposit is $10,000'),
});

const confirmSchema = z.object({
  txHash: z.string().min(1, 'Transaction hash is required'),
});

type CryptoDepositForm = z.infer<typeof cryptoDepositSchema>;
type StripeDepositForm = z.infer<typeof stripeDepositSchema>;
type ConfirmForm = z.infer<typeof confirmSchema>;

export default function DepositPage() {
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const queryClient = useQueryClient();

  const cryptoForm = useForm<CryptoDepositForm>({
    resolver: zodResolver(cryptoDepositSchema),
    defaultValues: { amount: 10, cryptoCurrency: 'USDT' },
  });

  const stripeForm = useForm<StripeDepositForm>({
    resolver: zodResolver(stripeDepositSchema),
    defaultValues: { amount: 25 },
  });

  const confirmForm = useForm<ConfirmForm>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { txHash: '' },
  });

  const cryptoMutation = useMutation({
    mutationFn: (data: CryptoDepositForm) => createDeposit(data),
    onSuccess: (data) => setDeposit(data),
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to create deposit');
    },
  });

  const stripeMutation = useMutation({
    mutationFn: (data: StripeDepositForm) => createStripeCheckout(data.amount),
    onSuccess: (data) => {
      // Validate that the URL is a Stripe checkout URL before redirecting
      try {
        const url = new URL(data.url);
        if (url.hostname === 'checkout.stripe.com' || url.hostname.endsWith('.stripe.com')) {
          window.location.href = data.url;
        } else {
          toast.error('Invalid payment URL received. Please try again.');
          console.error('Invalid Stripe URL:', data.url);
        }
      } catch (err) {
        toast.error('Invalid payment URL format. Please try again.');
        console.error('URL parsing error:', err);
      }
    },
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to create checkout session');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (data: ConfirmForm) => confirmDeposit(deposit!.depositId, data.txHash),
    onSuccess: () => {
      toast.success('Deposit confirmed! Funds will be credited after verification.');
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      setDeposit(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to confirm deposit');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (deposit) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setDeposit(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Complete Payment</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send {deposit.cryptoCurrency}</CardTitle>
            <CardDescription>
              Send exactly {deposit.cryptoAmount} {deposit.cryptoCurrency} to the address below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Amount (USD)</p>
              <p className="text-xl font-bold">{formatCurrency(deposit.amount)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Crypto Amount</p>
              <p className="text-lg font-mono">
                {deposit.cryptoAmount} {deposit.cryptoCurrency}
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Payment Address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                  {deposit.paymentAddress}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(deposit.paymentAddress)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Separator />
            <Form {...confirmForm}>
              <form
                onSubmit={confirmForm.handleSubmit((data) => confirmMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={confirmForm.control}
                  name="txHash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Hash</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your transaction hash" {...field} />
                      </FormControl>
                      <FormDescription>
                        Paste the transaction hash after sending the payment
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={confirmMutation.isPending}>
                  {confirmMutation.isPending ? 'Confirming...' : 'Confirm Payment'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/billing">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Deposit Funds</h1>
      </div>

      <Tabs defaultValue="stripe">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stripe" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Card / Apple Pay
          </TabsTrigger>
          <TabsTrigger value="crypto" className="gap-2">
            <Bitcoin className="h-4 w-4" />
            Cryptocurrency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stripe">
          <Card>
            <CardHeader>
              <CardTitle>Pay with Card</CardTitle>
              <CardDescription>
                Quick and secure payment via Stripe (Visa, Mastercard, Apple Pay, Google Pay)
              </CardDescription>
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
                          <Input type="number" min={5} max={10000} step={1} {...field} />
                        </FormControl>
                        <FormDescription>Min: $5.00 — Max: $10,000.00</FormDescription>
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
                      ? 'Redirecting...'
                      : `Pay $${stripeForm.watch('amount')?.toFixed(2) ?? '0.00'}`}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crypto">
          <Card>
            <CardHeader>
              <CardTitle>Pay with Crypto</CardTitle>
              <CardDescription>Add funds via BTC, ETH, or USDT</CardDescription>
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
                          <Input type="number" min={10} step={1} {...field} />
                        </FormControl>
                        <FormDescription>Minimum deposit: $10.00</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cryptoForm.control}
                    name="cryptoCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cryptocurrency</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USDT">USDT (Tether)</SelectItem>
                            <SelectItem value="BTC">BTC (Bitcoin)</SelectItem>
                            <SelectItem value="ETH">ETH (Ethereum)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={cryptoMutation.isPending}>
                    {cryptoMutation.isPending ? 'Creating...' : 'Continue to Payment'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
