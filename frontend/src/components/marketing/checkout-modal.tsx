'use client';

import { useMemo, useState } from 'react';
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
import { calculateLanding, checkoutLanding } from '@/lib/api/landings';
import { ApiError } from '@/lib/api/client';
import type { LandingCalculateResult, LandingTierResponse } from '@/lib/api/types';

interface CheckoutModalProps {
  slug: string;
  tiers: LandingTierResponse[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTier: LandingTierResponse;
  initialLink: string;
  defaultMinAmount: number;
}

function defaultQtyForTier(tier: LandingTierResponse, defaultMinAmount: number): number {
  const minByService = tier.service.minQuantity;
  const fallback = 1000;
  const preferred = Math.max(minByService, fallback);
  const unitPrice = tier.priceOverride ?? tier.service.pricePer1000;
  if (unitPrice <= 0) return preferred;
  const qtyForMinAmount = Math.ceil((defaultMinAmount / unitPrice) * 1000);
  return Math.max(preferred, qtyForMinAmount);
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function CheckoutModal(props: CheckoutModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <CheckoutModalBody
        key={`${props.initialTier.id}:${props.initialLink}:${props.open}`}
        {...props}
      />
    </Dialog>
  );
}

function CheckoutModalBody({
  slug,
  tiers,
  initialTier,
  initialLink,
  defaultMinAmount,
}: CheckoutModalProps) {
  const [email, setEmail] = useState('');
  const [tierId, setTierId] = useState(initialTier.id);
  const [link, setLink] = useState(initialLink);
  const [quantity, setQuantity] = useState<number>(
    defaultQtyForTier(initialTier, defaultMinAmount),
  );
  const [calcResult, setCalcResult] = useState<LandingCalculateResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === tierId) ?? initialTier,
    [tiers, tierId, initialTier],
  );

  const calcMutation = useMutation({
    mutationFn: () =>
      calculateLanding(slug, {
        serviceId: selectedTier.serviceId,
        quantity,
        link: link.trim() || undefined,
      }),
    onSuccess: (result) => {
      setCalcResult(result);
      if (!result.valid) {
        setFormError(result.reason ?? 'Invalid quantity or link.');
      } else {
        setFormError(null);
      }
    },
    onError: (err: unknown) => {
      setCalcResult(null);
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Unable to calculate price. Try again.');
      }
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkoutLanding(slug, {
        email: email.trim(),
        tierId: selectedTier.id,
        link: link.trim(),
        quantity,
      }),
    onSuccess: (result) => {
      window.location.href = result.checkoutUrl;
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Unable to start checkout. Try again.');
      }
    },
  });

  const validateLocally = (): string | null => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (!link.trim()) {
      return 'Paste a link to your video or channel.';
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return 'Quantity must be a positive number.';
    }
    if (quantity < selectedTier.service.minQuantity) {
      return `Minimum for ${selectedTier.service.name} is ${selectedTier.service.minQuantity}.`;
    }
    if (quantity > selectedTier.service.maxQuantity) {
      return `Maximum for ${selectedTier.service.name} is ${selectedTier.service.maxQuantity}.`;
    }
    return null;
  };

  const handleCalculate = () => {
    const err = validateLocally();
    if (err) {
      setFormError(err);
      setCalcResult(null);
      return;
    }
    setFormError(null);
    calcMutation.mutate();
  };

  const handleCheckout = () => {
    const err = validateLocally();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    checkoutMutation.mutate();
  };

  const priceDisplay =
    calcResult?.valid && calcResult.price !== null ? formatUsd(calcResult.price) : null;

  return (
    <>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>
            No registration needed. You&apos;ll get an order confirmation by email.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="co-email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <Input
              id="co-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="co-tier" className="mb-1.5 block text-sm font-medium">
              Service
            </label>
            <select
              id="co-tier"
              value={tierId}
              onChange={(e) => {
                const next = e.target.value;
                setTierId(next);
                setCalcResult(null);
                const t = tiers.find((x) => x.id === next);
                if (t) setQuantity(defaultQtyForTier(t, defaultMinAmount));
              }}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titleOverride ?? t.service.name} — $
                  {(t.priceOverride ?? t.service.pricePer1000).toFixed(2)} / {t.unit}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="co-link" className="mb-1.5 block text-sm font-medium">
              Link
            </label>
            <Input
              id="co-link"
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Enter a link to your video or channel"
            />
          </div>
          <div>
            <label htmlFor="co-qty" className="mb-1.5 block text-sm font-medium">
              Quantity
            </label>
            <Input
              id="co-qty"
              type="number"
              min={selectedTier.service.minQuantity}
              max={selectedTier.service.maxQuantity}
              value={quantity}
              onChange={(e) => {
                const next = Number(e.target.value);
                setQuantity(Number.isFinite(next) ? next : 0);
                setCalcResult(null);
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Min {selectedTier.service.minQuantity.toLocaleString()} · Max{' '}
              {selectedTier.service.maxQuantity.toLocaleString()}
            </p>
          </div>
          {priceDisplay ? (
            <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="text-lg font-bold">{priceDisplay}</span>
              </div>
            </div>
          ) : null}
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            {!calcResult?.valid ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleCalculate}
                disabled={calcMutation.isPending}
              >
                {calcMutation.isPending ? 'Calculating…' : 'Calculate Price'}
              </Button>
            ) : (
              <Button type="button" onClick={handleCheckout} disabled={checkoutMutation.isPending}>
                {checkoutMutation.isPending ? 'Starting Checkout…' : `Pay ${priceDisplay}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </>
  );
}
