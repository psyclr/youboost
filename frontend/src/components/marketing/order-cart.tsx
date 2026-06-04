'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CartItem } from './cart-item';
import { formatUsd } from '@/lib/landings/calculator';
import { checkoutLandingCart } from '@/lib/api/landings';
import { publicApiErrorMessage } from '@/lib/api/error-messages';
import type { UseCart } from '@/lib/landings/use-cart';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Provider = 'stripe' | 'cryptomus';

export function OrderCart({ slug, cart }: { slug: string; cart: UseCart }) {
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<Provider>('stripe');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      checkoutLandingCart(slug, {
        email: email.trim(),
        paymentProvider: provider,
        items: cart.items.map((i) => ({
          tierId: i.tier.id,
          link: i.link.trim(),
          quantity: i.quantity,
        })),
      }),
    onSuccess: (data) => {
      try {
        const url = new URL(data.checkoutUrl);
        const ok =
          url.hostname === 'checkout.stripe.com' ||
          url.hostname.endsWith('.stripe.com') ||
          url.hostname === 'cryptomus.com' ||
          url.hostname.endsWith('.cryptomus.com');
        if (ok) globalThis.location.href = data.checkoutUrl;
        else setError('Invalid payment URL received. Please try again.');
      } catch {
        setError('Invalid payment URL format. Please try again.');
      }
    },
    onError: (err) => setError(publicApiErrorMessage(err, 'Unable to start checkout. Try again.')),
  });

  const validate = (): boolean => {
    for (const i of cart.items) {
      if (!i.link.trim()) {
        setError('Paste a link for every service.');
        return false;
      }
      if (!Number.isFinite(i.quantity) || i.quantity < i.tier.service.minQuantity) {
        setError(
          `Minimum for ${i.tier.service.name} is ${i.tier.service.minQuantity.toLocaleString()}.`,
        );
        return false;
      }
      if (i.quantity > i.tier.service.maxQuantity) {
        setError(
          `Maximum for ${i.tier.service.name} is ${i.tier.service.maxQuantity.toLocaleString()}.`,
        );
        return false;
      }
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return false;
    }
    return true;
  };

  const onPay = () => {
    setError(null);
    if (validate()) mutation.mutate();
  };

  if (cart.count === 0) {
    return (
      <div
        className="flex h-fit min-w-0 flex-col gap-5 rounded-[5px] border p-5"
        style={{ background: '#141414', borderColor: '#363636' }}
        data-testid="order-panel"
      >
        <p className="text-sm text-muted-foreground">Pick a service to start.</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-fit min-w-0 flex-col gap-4 rounded-[5px] border p-5"
      style={{ background: '#141414', borderColor: '#363636' }}
      data-testid="order-panel"
    >
      {/* Items scroll inside the panel so a long cart never stretches the page;
          the email/provider/Pay controls below stay pinned and the panel stays
          sticky (see ServiceTiers). */}
      <div
        data-testid="cart-items"
        className="-mr-1 flex max-h-[46vh] flex-col gap-3 overflow-y-auto pr-1"
      >
        {cart.items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onRemove={() => cart.removeItem(item.id)}
            onToggle={() => cart.toggleCollapse(item.id)}
            onLink={(v) => {
              cart.setLink(item.id, v);
              if (error) setError(null);
            }}
            onQuantity={(v) => cart.setQuantity(item.id, v)}
          />
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-white">Email</span>
        <Input
          type="email"
          value={email}
          placeholder="you@example.com"
          autoComplete="email"
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-white">Payment</span>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
          {(['stripe', 'cryptomus'] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              aria-pressed={provider === p}
              className="rounded-[3px] border px-3 py-2.5 text-[13px] font-medium text-white"
              style={{
                borderColor: provider === p ? '#FE2721' : '#363636',
                background: provider === p ? '#1f1f1f' : '#0a0a0a',
              }}
            >
              {p === 'stripe' ? 'Card' : 'Crypto'}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-[13px] text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={onPay}
        disabled={mutation.isPending}
        aria-label={`Pay ${formatUsd(cart.total)}`}
        className="w-full"
      >
        {mutation.isPending ? 'Redirecting…' : `Pay ${formatUsd(cart.total)}`}
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-[#676767]">
        Guest checkout creates an account automatically after payment.
      </p>
    </div>
  );
}
