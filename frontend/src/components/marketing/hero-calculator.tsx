'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { publicApiErrorMessage } from '@/lib/api/error-messages';
import { calculateLanding } from '@/lib/api/landings';
import {
  defaultQtyForTier,
  estimatePrice,
  formatUsd,
  pickDefaultTier,
} from '@/lib/landings/calculator';
import type { LandingCalculateResult, LandingResponse, LandingTierResponse } from '@/lib/api/types';
import { PaymentMethodModal } from './payment-method-modal';

type Step = 'link' | 'details';

interface HeroCalculatorProps {
  slug: string;
  hero: LandingResponse['hero'];
  tiers: LandingResponse['tiers'];
}

export function HeroCalculator({ slug, hero, tiers }: HeroCalculatorProps) {
  const initialTier = pickDefaultTier(tiers, hero.defaultServiceId);
  if (!initialTier) return <HeroIllustration />;
  return <HeroCalculatorBody slug={slug} hero={hero} tiers={tiers} initialTier={initialTier} />;
}

function HeroIllustration() {
  return (
    <Image
      src="/brand/red-bar-3d.png"
      alt=""
      width={480}
      height={480}
      className="h-auto w-full max-w-[480px]"
      style={{ filter: 'drop-shadow(0 24px 48px rgba(241,0,4,0.4))' }}
      priority
    />
  );
}

interface BodyProps extends HeroCalculatorProps {
  initialTier: LandingTierResponse;
}

function HeroCalculatorBody({ slug, hero, tiers, initialTier }: BodyProps) {
  const [step, setStep] = useState<Step>('link');
  const [link, setLink] = useState('');
  const [tierId, setTierId] = useState(initialTier.id);
  const [quantity, setQuantity] = useState(defaultQtyForTier(initialTier, hero.minAmount));
  const [calcResult, setCalcResult] = useState<LandingCalculateResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const selectedTier = tiers.find((tier) => tier.id === tierId) ?? initialTier;
  const localPrice = estimatePrice(selectedTier, quantity);
  const modalPrice = calcResult?.valid && calcResult.price !== null ? calcResult.price : localPrice;

  const calcMutation = useMutation({
    mutationFn: () =>
      calculateLanding(slug, {
        serviceId: selectedTier.serviceId,
        quantity,
        link: link.trim(),
      }),
    onSuccess: (result) => {
      setCalcResult(result);
      if (!result.valid) {
        setFormError(result.reason ?? 'Invalid quantity or link.');
        setPayOpen(false);
      } else {
        setFormError(null);
        setPayOpen(true);
      }
    },
    onError: (err: unknown) => {
      setCalcResult(null);
      setFormError(publicApiErrorMessage(err, 'Unable to calculate price. Try again.'));
    },
  });

  const validateForPay = (): string | null => {
    if (!link.trim()) return 'Paste a link to your video or channel.';
    if (!Number.isFinite(quantity) || quantity <= 0) return 'Quantity must be positive.';
    if (quantity < selectedTier.service.minQuantity) {
      return `Minimum for this service is ${selectedTier.service.minQuantity.toLocaleString()}.`;
    }
    if (quantity > selectedTier.service.maxQuantity) {
      return `Maximum for this service is ${selectedTier.service.maxQuantity.toLocaleString()}.`;
    }
    return null;
  };

  const handleGo = () => {
    if (!link.trim()) {
      setFormError('Paste a link to your video or channel.');
      return;
    }
    setFormError(null);
    setStep('details');
  };

  const handlePay = () => {
    const err = validateForPay();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    calcMutation.mutate();
  };

  const handleTierChange = (nextTierId: string) => {
    const tier = tiers.find((item) => item.id === nextTierId);
    setTierId(nextTierId);
    setCalcResult(null);
    if (tier) setQuantity(defaultQtyForTier(tier, hero.minAmount));
  };

  const handleQuantityChange = (next: number) => {
    setQuantity(next);
    setCalcResult(null);
  };

  const handleLinkChangeDetails = (next: string) => {
    setLink(next);
    setCalcResult(null);
  };

  return (
    <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#FFAE00]">
            Instant calculator
          </p>
          {step === 'details' ? (
            <h2 className="mt-1 text-2xl font-bold text-white">{formatUsd(localPrice)}</h2>
          ) : (
            <h2 className="mt-1 text-2xl font-bold text-white">
              {hero.eyebrow ?? 'Guest checkout'}
            </h2>
          )}
        </div>
        <Image
          src="/brand/red-bar-3d.png"
          alt=""
          width={80}
          height={80}
          className="h-16 w-16 shrink-0 object-contain"
          priority
        />
      </div>

      {step === 'link' ? (
        <LinkStep
          link={link}
          placeholder={hero.placeholder}
          fineprint={hero.fineprint}
          error={formError}
          onLinkChange={(value) => {
            setLink(value);
            if (formError) setFormError(null);
          }}
          onGo={handleGo}
        />
      ) : (
        <DetailsStep
          slug={slug}
          link={link}
          tierId={tierId}
          tiers={tiers}
          quantity={quantity}
          selectedTier={selectedTier}
          payLabel={`Pay ${formatUsd(localPrice)}`}
          pending={calcMutation.isPending}
          error={formError}
          placeholder={hero.placeholder}
          onLinkChange={handleLinkChangeDetails}
          onTierChange={handleTierChange}
          onQuantityChange={handleQuantityChange}
          onPay={handlePay}
        />
      )}

      <PaymentMethodModal
        slug={slug}
        open={payOpen}
        onOpenChange={setPayOpen}
        tier={selectedTier}
        link={link.trim()}
        quantity={quantity}
        price={modalPrice}
      />
    </div>
  );
}

interface LinkStepProps {
  link: string;
  placeholder: string;
  fineprint: string | null;
  error: string | null;
  onLinkChange: (value: string) => void;
  onGo: () => void;
}

function LinkStep({ link, placeholder, fineprint, error, onLinkChange, onGo }: LinkStepProps) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-white/80">Link</span>
        <Input
          value={link}
          onChange={(event) => onLinkChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onGo();
            }
          }}
          placeholder={placeholder}
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        onClick={onGo}
        disabled={link.trim() === ''}
        className="w-full bg-brand-red text-white hover:bg-brand-red/90"
      >
        Go →
      </Button>
      {fineprint ? <p className="text-xs text-white/45">{fineprint}</p> : null}
    </div>
  );
}

interface DetailsStepProps {
  slug: string;
  link: string;
  tierId: string;
  tiers: LandingResponse['tiers'];
  quantity: number;
  selectedTier: LandingTierResponse;
  payLabel: string;
  pending: boolean;
  error: string | null;
  placeholder: string;
  onLinkChange: (value: string) => void;
  onTierChange: (tierId: string) => void;
  onQuantityChange: (qty: number) => void;
  onPay: () => void;
}

function DetailsStep({
  link,
  tierId,
  tiers,
  quantity,
  selectedTier,
  payLabel,
  pending,
  error,
  placeholder,
  onLinkChange,
  onTierChange,
  onQuantityChange,
  onPay,
}: DetailsStepProps) {
  const qtyInvalid =
    !Number.isFinite(quantity) ||
    quantity < selectedTier.service.minQuantity ||
    quantity > selectedTier.service.maxQuantity;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-white/80">Link</span>
        <Input
          value={link}
          onChange={(event) => onLinkChange(event.target.value)}
          placeholder={placeholder}
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-white/80">Service</span>
        <select
          value={tierId}
          onChange={(event) => onTierChange(event.target.value)}
          aria-label="Service"
          className="h-11 w-full rounded-lg border border-white/10 bg-brand-ink px-3 text-sm text-white outline-none focus:border-white/40"
        >
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.titleOverride ?? tier.service.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-white/80">Quantity</span>
        <Input
          type="number"
          min={selectedTier.service.minQuantity}
          max={selectedTier.service.maxQuantity}
          value={quantity}
          onChange={(event) => {
            const next = Number(event.target.value);
            onQuantityChange(Number.isFinite(next) ? next : 0);
          }}
          aria-label="Quantity"
          className="border-white/10 bg-white/5 text-white"
        />
      </label>
      <p className="text-xs text-white/50">
        Min {selectedTier.service.minQuantity.toLocaleString()} · Max{' '}
        {selectedTier.service.maxQuantity.toLocaleString()}
      </p>
      {error ? (
        <p className="text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        onClick={onPay}
        disabled={pending || qtyInvalid}
        className="w-full bg-brand-red text-white hover:bg-brand-red/90"
      >
        {pending ? 'Calculating…' : payLabel}
      </Button>
    </div>
  );
}
