'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Eye,
  MessageSquare,
  ThumbsUp,
  Users,
  Music2,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
} from 'lucide-react';
import { useCart } from '@/lib/landings/use-cart';
import { OrderCart } from './order-cart';
import type { LandingResponse, LandingTierResponse } from '@/lib/api/types';

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

function findYoutubeViewsTier(tiers: LandingResponse['tiers']): LandingTierResponse | null {
  return (
    tiers.find(
      (t) =>
        t.service.platform.toUpperCase() === 'YOUTUBE' && t.service.type.toUpperCase() === 'VIEWS',
    ) ?? null
  );
}

export function ServiceTiers({ slug, tiers, defaultMinAmount }: ServiceTiersProps) {
  const [platform, setPlatform] = useState<PlatformId>('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pending hero link to apply to the first cart item that has an empty link
  const pendingHeroLink = useRef<string | null>(null);

  const cart = useCart({ defaultMinAmount });
  // Keep a stable ref to cart.setLink to use inside the hero-link effect
  const cartRef = useRef(cart);
  cartRef.current = cart;

  // Pre-fill link from hero (sessionStorage on mount + custom event).
  // Prefer auto-adding the YouTube-views tier; otherwise fall back to filling
  // the first empty-link item (or storing the link as pending).
  useEffect(() => {
    const applyHeroLink = (detail: string) => {
      const ytTier = findYoutubeViewsTier(tiers);
      if (ytTier) {
        setPlatform('YOUTUBE');
        setPage(1);
        const existing = cartRef.current.items.find((i) => i.tier.id === ytTier.id);
        if (existing) {
          cartRef.current.setLink(existing.id, detail);
        } else {
          cartRef.current.addItem(ytTier);
          setTimeout(() => {
            const added = cartRef.current.items.find((i) => i.tier.id === ytTier.id);
            if (added) cartRef.current.setLink(added.id, detail);
          }, 0);
        }
      } else {
        // Fallback: fill the first empty-link item, else store as pending.
        const emptyItem = cartRef.current.items.find((i) => !i.link.trim());
        if (emptyItem) cartRef.current.setLink(emptyItem.id, detail);
        else pendingHeroLink.current = detail;
      }
      if (panelRef.current) {
        panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const stored = (() => {
      try {
        return sessionStorage.getItem(HERO_LINK_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (stored) applyHeroLink(stored);

    const onHeroLink = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') applyHeroLink(detail);
    };
    window.addEventListener('youboost:hero-link', onHeroLink);
    return () => window.removeEventListener('youboost:hero-link', onHeroLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleAddToOrder = (tier: LandingTierResponse) => {
    cart.addItem(tier);
    // After adding, apply any pending hero link to the first item with an empty link
    // We schedule this via a micro-task so the state update has applied
    if (pendingHeroLink.current) {
      const link = pendingHeroLink.current;
      pendingHeroLink.current = null;
      // The newly added item will be last in the list, and it has an empty link.
      // We call setLink via a setTimeout(0) so the state update from addItem settles.
      setTimeout(() => {
        const items = cartRef.current.items;
        const emptyItem = items.find((i) => !i.link.trim());
        if (emptyItem) cartRef.current.setLink(emptyItem.id, link);
      }, 0);
    }
    if (panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
                return (
                  <article
                    key={tier.id}
                    data-tier-card={tier.id}
                    className="overflow-hidden rounded-[5px] border transition-colors"
                    style={{
                      background: '#141414',
                      borderColor: '#262626',
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

        {/* RIGHT: order panel — pinned on desktop so it stays in view while the
            left column scrolls; the panel's item list scrolls internally. */}
        <div
          ref={panelRef}
          aria-label="Order panel"
          className="min-w-0 overflow-hidden lg:sticky lg:top-6 lg:self-start"
        >
          <OrderCart slug={slug} cart={cart} />
        </div>
      </div>
    </section>
  );
}
