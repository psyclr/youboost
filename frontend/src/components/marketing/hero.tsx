'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { LandingResponse } from '@/lib/api/types';

interface HeroProps {
  hero: LandingResponse['hero'];
  stats: LandingResponse['stats'];
}

const HERO_LINK_STORAGE_KEY = 'youboost:landing-link';

export function Hero({ hero, stats }: HeroProps) {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGo = () => {
    const trimmed = link.trim();
    if (!trimmed) {
      setError('Paste a link to your video or channel.');
      return;
    }
    setError(null);
    try {
      sessionStorage.setItem(HERO_LINK_STORAGE_KEY, trimmed);
    } catch {
      // sessionStorage unavailable — fail silently, services panel still works
    }
    window.dispatchEvent(new CustomEvent('youboost:hero-link', { detail: trimmed }));
    const target = document.getElementById('services');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative overflow-hidden bg-background text-white">
      {/* Figma hero glows: red (Ellipse 1) + magenta (Ellipse 2) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(800px 600px at 78% 50%, rgba(255,0,0,0.42) 0%, rgba(255,0,0,0) 60%), radial-gradient(700px 500px at 62% 30%, rgba(208,0,77,0.35) 0%, rgba(208,0,77,0) 65%)',
        }}
      />
      {/* Bottom-fade scrim (Rectangle 9 in Figma) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #0a0a0a 80%)' }}
      />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-8 px-6 py-20 md:px-8 md:py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-[600px]">
          <h1
            className="text-4xl font-medium leading-[1.01] tracking-[-0.01em] text-white md:text-[60px]"
            style={{ fontWeight: 500 }}
          >
            {hero.title}
            {hero.accent ? (
              <>
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'var(--grad-cta)' }}
                >
                  {hero.accent}
                </span>
              </>
            ) : null}
          </h1>
          <p className="mt-5 max-w-[480px] text-base font-light leading-[1.5] text-muted-foreground md:text-[17px]">
            {hero.lead}
          </p>

          <div className="mt-7 flex items-stretch gap-2.5">
            {/* Input with gradient red-orange border (Figma stroke fill_PE9ICH) */}
            <div
              className="relative w-full max-w-[348px] rounded-[5px] p-px"
              style={{
                background: 'linear-gradient(5deg, #363636 0%, #FF222E 0%, #FF561A 92%)',
              }}
            >
              <input
                type="text"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGo();
                  }
                }}
                placeholder={hero.placeholder || 'Enter the link or title of the video'}
                aria-label="Link to your video or channel"
                className="block w-full rounded-[4px] bg-card px-3.5 py-[14px] text-[15px] font-light text-white placeholder:text-[#787878] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleGo}
              disabled={link.trim() === ''}
              aria-label="Go"
              className="relative shrink-0 overflow-hidden rounded-[5px] px-[22px] py-[14px] text-[15px] font-semibold text-white shadow-[0_0_22px_rgba(255,96,26,0.32)] transition-transform hover:scale-[1.02] active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  'var(--grad-cta-vertical, linear-gradient(180deg, #FF0077 1%, #FF2B1B 54%, #FF691A 100%))',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[5px]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.29) 100%)',
                  mixBlendMode: 'overlay',
                }}
              />
              <span className="relative">Go!</span>
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-10 flex flex-wrap items-stretch gap-0 border-t border-white/10 pt-7">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col pr-6 ${i < stats.length - 1 ? 'border-r border-white/15' : ''} ${i > 0 ? 'pl-6' : ''}`}
              >
                <strong className="text-xl font-medium text-white" style={{ fontWeight: 500 }}>
                  {stat.value}
                </strong>
                <span className="mt-1 text-[13px] font-normal text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <Image
            src="/brand/hero-play-3d.png"
            alt=""
            width={547}
            height={648}
            priority
            className="h-auto w-full max-w-[547px] select-none"
            style={{
              filter: 'drop-shadow(0 40px 80px rgba(255,0,0,0.35))',
              userSelect: 'none',
            }}
          />
        </div>
      </div>
    </section>
  );
}
