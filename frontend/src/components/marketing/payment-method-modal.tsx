'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { checkoutLanding } from '@/lib/api/landings';
import { publicApiErrorMessage } from '@/lib/api/error-messages';
import { formatUsd } from '@/lib/landings/calculator';
import type { LandingTierResponse } from '@/lib/api/types';

type Provider = 'stripe' | 'cryptomus';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PaymentMethodModalProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: LandingTierResponse;
  link: string;
  quantity: number;
  price: number;
}

export function PaymentMethodModal(props: PaymentMethodModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <PaymentMethodModalBody key="open" {...props} /> : null}
    </Dialog>
  );
}

function PaymentMethodModalBody({
  slug,
  onOpenChange,
  tier,
  link,
  quantity,
  price,
}: PaymentMethodModalProps) {
  const [email, setEmail] = useState('');
  const [methodPending, setMethodPending] = useState<Provider | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: (provider: Provider) =>
      checkoutLanding(slug, {
        email: email.trim(),
        tierId: tier.id,
        link,
        quantity,
        paymentProvider: provider,
      }),
    onSuccess: (result) => {
      window.location.href = result.checkoutUrl;
    },
    onError: (err: unknown) => {
      setMethodPending(null);
      setModalError(publicApiErrorMessage(err, 'Unable to start checkout. Try again.'));
    },
  });

  const startCheckout = (provider: Provider) => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setModalError('Enter a valid email address.');
      return;
    }
    setModalError(null);
    setMethodPending(provider);
    checkoutMutation.mutate(provider);
  };

  const serviceName = tier.titleOverride ?? tier.service.name;
  const cleanLink = link.replace(/^https?:\/\//, '');

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Pay {formatUsd(price)}</DialogTitle>
        <DialogDescription>
          No registration needed. You&apos;ll get an order confirmation by email.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{serviceName}</span>
            <span className="font-medium">{quantity.toLocaleString()}</span>
          </div>
          <div className="mt-1.5 truncate text-xs text-muted-foreground" title={link}>
            {cleanLink}
          </div>
        </div>
        <div>
          <label htmlFor="pm-email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <Input
            id="pm-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (modalError) setModalError(null);
            }}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        {modalError ? (
          <p className="text-sm text-destructive" role="alert">
            {modalError}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => startCheckout('stripe')}
            disabled={methodPending !== null}
            className="w-full"
          >
            {methodPending === 'stripe' ? 'Redirecting…' : 'Pay with Card'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => startCheckout('cryptomus')}
            disabled={methodPending !== null}
            className="w-full"
          >
            {methodPending === 'cryptomus' ? 'Redirecting…' : 'Pay with Crypto'}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </DialogContent>
  );
}
