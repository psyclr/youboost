'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, MessageSquare, ThumbsUp, Users, Music2, Twitter, Facebook, Instagram, Youtube, Trash2, ChevronUp } from 'lucide-react';
import { PaymentMethodModal } from './payment-method-modal';
import { calculateLanding } from '@/lib/api/landings';
import { publicApiErrorMessage } from '@/lib/api/error-messages';
import {
  defaultQtyForTier,
  estimatePrice,
  formatUsd,
  pickDefaultTier,
} from '@/lib/landings/calculator';
import type { LandingCalculateResult, LandingResponse, LandingTierResponse } from '@/lib/api/types';

interface ServiceTiersProps {
  slug: string;
  tiers: LandingResponse['tiers'];
  defaultMinAmount: number;
}

const HERO_LINK_STORAGE_KEY = 'youboost:landing-link';
const PAGE_SIZE = 6;

const PLATFORMS = [
  { id: 'ALL', label: 'All' },
  { id: 'YOUTUBE', label: 'YouTube' },
  { id: 'INSTAGRAM', label: 'Instagram' },
  { id: 'TIKTOK', label: 'TikTok' },
  { id: 'TWITTER', label: 'Twitter' },
  { id: 'FACEBOOK', label: 'Facebook' },
] as const;

type PlatformId = (typeof PLATFORMS)[number]['id'];

function iconFor(platform: string, type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('comment')) return MessageSquare;
  if (t.includes('like')) return ThumbsUp;
  if (t.includes('subscrib') || t.includes('follow')) return Users;
  if (t.includes('view')) return Eye;
  const p = platform.toUpperCase();
  if (p === 'YOUTUBE') return Youtube;
  if (p === 'INSTAGRAM') return Instagram;
  if (p === 'TIKTOK') return Music2;
  if (p === 'TWITTER') return Twitter;
  if (p === 'FACEBOOK') return Facebook;
  return Eye;
}

function displayPrice(tier: LandingTierResponse): number {
  return tier.priceOverride ?? tier.service.pricePer1000;
}

export function ServiceTiers({ slug, tiers, defaultMinAmount }: ServiceTiersProps) {
  const initialTier = pickDefaultTier(tiers, null) ?? tiers[0] ?? null;
  const [platform, setPlatform] = useState<PlatformId>('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [link, setLink] = useState('');
  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    initialTier ? initialTier.id : null,
  );
  const [quantity, setQuantity] = useState<number>(
    initialTier ? defaultQtyForTier(initialTier, defaultMinAmount) : 0,
  );
  const [payOpen, setPayOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<LandingCalculateResult | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pre-fill link from hero (sessionStorage on mount + custom event)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(HERO_LINK_STORAGE_KEY);
      if (stored) setLink(stored);
    } catch {
      // ignore
    }
    const onHeroLink = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') {
        setLink(detail);
        if (panelRef.current) {
          panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };
    window.addEventListener('youboost:hero-link', onHeroLink);
    return () => window.removeEventListener('youboost:hero-link', onHeroLink);
  }, []);

  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === selectedTierId) ?? initialTier,
    [tiers, selectedTierId, initialTier],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tiers.filter((t) => {
      if (platform !== 'ALL' && t.service.platform.toUpperCase() !== platform) return false;
      if (q) {
        const title = (t.titleOverride ?? t.service.name).toLowerCase();
        if (!title.includes(q)) return false;
      }
      return true;
    });
  }, [tiers, platform, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedTiers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const localPrice = selectedTier ? estimatePrice(selectedTier, quantity) : 0;
  const modalPrice =
    calcResult?.valid && calcResult.price !== null ? calcResult.price : localPrice;
  const price = localPrice;

  const calcMutation = useMutation({
    mutationFn: () => {
      if (!selectedTier) throw new Error('No tier selected');
      return calculateLanding(slug, {
        serviceId: selectedTier.serviceId,
        quantity,
        link: link.trim(),
      });
    },
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

  const handleAddToOrder = (tier: LandingTierResponse) => {
    setSelectedTierId(tier.id);
    setQuantity(defaultQtyForTier(tier, defaultMinAmount));
    setCalcResult(null);
    setFormError(null);
    if (panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePay = () => {
    if (!selectedTier) return;
    if (!link.trim()) {
      setFormError('Paste a link to your video or channel.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < selectedTier.service.minQuantity) {
      setFormError(`Minimum is ${selectedTier.service.minQuantity.toLocaleString()}.`);
      return;
    }
    if (quantity > selectedTier.service.maxQuantity) {
      setFormError(`Maximum is ${selectedTier.service.maxQuantity.toLocaleString()}.`);
      return;
    }
    setFormError(null);
    calcMutation.mutate();
  };

  return (
    <section id="services" className="bg-background pb-24">
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-24 md:px-8">
        <h2 className="text-3xl font-medium text-white md:text-[25px]" style={{ fontWeight: 500 }}>
          Instant results without registration
        </h2>
        <p className="mt-2 text-[17px] font-normal text-[#676767]">
          Boost your account in just a few clicks
        </p>
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-5 px-6 md:px-8 lg:grid-cols-[1fr_422px]">
        {/* LEFT: tabs + search + cards + pagination */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[5px] border p-[5px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ background: '#141414', borderColor: '#262626' }}
            >
              {PLATFORMS.map((p) => {
                const active = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPlatform(p.id);
                      setPage(1);
                    }}
                    className="shrink-0 whitespace-nowrap rounded-[3px] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors"
                    style={{
                      background: active
                        ? 'linear-gradient(0deg, #262626 0%, #393939 100%)'
                        : 'transparent',
                      color: active ? '#ffffff' : '#a2a2a2',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex w-full md:w-auto">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Enter a name to search"
                aria-label="Search services"
                className="w-full min-w-0 rounded-l-[5px] border border-r-0 px-3.5 py-3 text-[13px] font-light text-white placeholder:text-[#787878] focus:outline-none md:w-[215px]"
                style={{ background: '#141414', borderColor: '#363636' }}
              />
              <button
                type="button"
                className="rounded-r-[5px] px-5 py-3 text-[13px] font-semibold text-white"
                style={{ background: 'linear-gradient(180deg, #383838 0%, #272727 100%)' }}
              >
                Search
              </button>
            </div>
          </div>

          {pagedTiers.length === 0 ? (
            <div
              className="flex h-48 items-center justify-center rounded-[5px] border text-sm text-muted-foreground"
              style={{ background: '#141414', borderColor: '#262626' }}
            >
              No services match your filters.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pagedTiers.map((tier) => {
                const Icon = iconFor(tier.service.platform, tier.service.type);
                const title = tier.titleOverride ?? tier.service.name;
                const desc = tier.descOverride ?? tier.service.description ?? '';
                const isSelected = selectedTier?.id === tier.id;
                return (
                  <article
                    key={tier.id}
                    data-tier-card={tier.id}
                    className="overflow-hidden rounded-[5px] border transition-colors"
                    style={{
                      background: '#141414',
                      borderColor: isSelected ? '#FE2721' : '#262626',
                    }}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-[5px] text-white"
                        style={{ background: 'linear-gradient(145deg, #FE2721 0%, #8E0014 100%)' }}
                      >
                        <Icon className="size-5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-white">{title}</h3>
                        {desc ? (
                          <p className="truncate text-[12px] text-[#a2a2a2]">{desc}</p>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className="flex items-center justify-between gap-3 border-t px-3 py-3"
                      style={{ borderColor: '#262626' }}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                          <span className="text-[22px] font-bold leading-none text-white">
                            ${displayPrice(tier).toFixed(2)}
                          </span>
                          <span className="text-[11px] text-[#a2a2a2]">/ {tier.unit}</span>
                        </div>
                        <span className="mt-1 text-[11px] text-[#676767]">
                          Min: {tier.service.minQuantity.toLocaleString()} — Max:{' '}
                          {tier.service.maxQuantity.toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddToOrder(tier)}
                        className="rounded-[5px] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1f1f1f]"
                        style={{ background: '#0a0a0a', border: '1px solid #363636' }}
                      >
                        Pay
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
                const active = n === safePage;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className="rounded-[3px] px-2.5 py-1 text-[12px] font-medium transition-colors"
                    style={{
                      background: active ? '#FE2721' : '#141414',
                      color: '#ffffff',
                      border: active ? 'none' : '1px solid #262626',
                    }}
                    aria-label={`Page ${n}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* RIGHT: order panel */}
        <div
          ref={panelRef}
          className="flex h-fit min-w-0 flex-col gap-5 rounded-[5px] border p-5"
          style={{ background: '#141414', borderColor: '#363636' }}
          aria-label="Order panel"
          data-testid="order-panel"
        >
          {selectedTier ? (
            <>
              <div
                className="overflow-hidden rounded-[3px] border"
                style={{ borderColor: '#363636' }}
              >
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-[15px] font-semibold text-white">
                      {selectedTier.titleOverride ?? selectedTier.service.name}
                    </h4>
                    {selectedTier.service.description ? (
                      <p className="truncate text-[12px] text-[#a2a2a2]">
                        {selectedTier.service.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[18px] font-bold text-white">{formatUsd(price)}</span>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-label="Remove item"
                        disabled
                        className="rounded-[3px] border p-1.5 text-[#676767]"
                        style={{ borderColor: '#363636' }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Collapse item"
                        className="rounded-[3px] border p-1.5 text-[#676767]"
                        style={{ borderColor: '#363636' }}
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  className="flex flex-col gap-3 border-t px-3 py-3"
                  style={{ borderColor: '#363636' }}
                >
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-white">Add a link</span>
                    <input
                      type="text"
                      value={link}
                      onChange={(e) => {
                        setLink(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="https://www.youtube.com/watch?v=…"
                      aria-label="Add a link"
                      className="w-full rounded-[3px] border px-3 py-2.5 text-[13px] text-white placeholder:text-[#676767] focus:outline-none"
                      style={{ background: '#0a0a0a', borderColor: '#363636' }}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-white">Quantity</span>
                    <input
                      type="number"
                      min={selectedTier.service.minQuantity}
                      max={selectedTier.service.maxQuantity}
                      value={quantity}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setQuantity(Number.isFinite(next) ? next : 0);
                        setCalcResult(null);
                      }}
                      aria-label="Quantity"
                      className="w-full rounded-[3px] border px-3 py-2.5 text-[13px] text-white focus:outline-none"
                      style={{ background: '#0a0a0a', borderColor: '#363636' }}
                    />
                  </label>
                </div>
              </div>

              {formError ? (
                <p className="text-[13px] text-red-300" role="alert">
                  {formError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handlePay}
                disabled={calcMutation.isPending}
                aria-label={`Pay ${formatUsd(price)}`}
                className="relative w-full overflow-hidden rounded-[5px] py-3.5 text-[15px] font-semibold text-white shadow-[0_0_22px_rgba(255,96,26,0.32)] transition-transform hover:scale-[1.01] active:scale-100 disabled:opacity-70"
                style={{
                  background:
                    'linear-gradient(90deg, #FF0077 0%, #FF2B1B 50%, #FF691A 100%)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.29) 100%)',
                    mixBlendMode: 'overlay',
                  }}
                />
                <span className="relative">
                  {calcMutation.isPending ? 'Calculating…' : `Pay ${formatUsd(price)}`}
                </span>
              </button>
              <p className="text-center text-[11px] leading-relaxed text-[#676767]">
                Guest checkout creates an account automatically after payment.
                <br />
                After clicking and paying, you automatically agree to the rules of our service.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a service on the left to start.</p>
          )}
        </div>
      </div>

      {selectedTier ? (
        <PaymentMethodModal
          slug={slug}
          open={payOpen}
          onOpenChange={setPayOpen}
          tier={selectedTier}
          link={link.trim()}
          quantity={quantity}
          price={modalPrice}
        />
      ) : null}
    </section>
  );
}
