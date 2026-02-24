'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDeposit, confirmDeposit } from '@/lib/api/billing';
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
import { Separator } from '@/components/ui/separator';
import { Copy, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const depositSchema = z.object({
  amount: z.coerce.number().min(10, 'Minimum deposit is $10'),
  cryptoCurrency: z.enum(['USDT', 'BTC', 'ETH']),
});

const confirmSchema = z.object({
  txHash: z.string().min(1, 'Transaction hash is required'),
});

type DepositForm = z.infer<typeof depositSchema>;
type ConfirmForm = z.infer<typeof confirmSchema>;

export default function DepositPage() {
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const queryClient = useQueryClient();

  const depositForm = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 10, cryptoCurrency: 'USDT' },
  });

  const confirmForm = useForm<ConfirmForm>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { txHash: '' },
  });

  const createMutation = useMutation({
    mutationFn: (data: DepositForm) => createDeposit(data),
    onSuccess: (data) => setDeposit(data),
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create deposit');
      }
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
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to confirm deposit');
      }
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

      <Card>
        <CardHeader>
          <CardTitle>Create Deposit</CardTitle>
          <CardDescription>Add funds to your account via cryptocurrency</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...depositForm}>
            <form
              onSubmit={depositForm.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={depositForm.control}
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
                control={depositForm.control}
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

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Continue to Payment'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
