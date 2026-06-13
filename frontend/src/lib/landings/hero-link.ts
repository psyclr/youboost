import { useEffect, useRef } from 'react';

// Hero → services-panel link handoff. The hero form stashes the entered link
// in sessionStorage (so a panel mounting later still picks it up) and fires a
// window event (so an already-mounted panel reacts immediately).
export const HERO_LINK_STORAGE_KEY = 'youboost:landing-link';
export const HERO_LINK_EVENT = 'youboost:hero-link';

/** Hero side: stash the link for late subscribers and notify mounted ones. */
export function emitHeroLink(link: string): void {
  try {
    sessionStorage.setItem(HERO_LINK_STORAGE_KEY, link);
  } catch {
    // sessionStorage unavailable — fail silently, services panel still works
  }
  window.dispatchEvent(new CustomEvent(HERO_LINK_EVENT, { detail: link }));
}

/**
 * Services-panel side: invokes `onLink` with the stored link on mount (if any)
 * and on every hero-link event afterwards. The handler is kept in a ref so the
 * subscription is mount-only yet always sees the latest props/state.
 */
export function useHeroLink(onLink: (link: string) => void): void {
  const handlerRef = useRef(onLink);

  // Sync after every commit (writing refs during render is forbidden by the
  // react-hooks/refs rule). Declared before the subscription effect so the
  // mount-time replay below already sees the latest handler.
  useEffect(() => {
    handlerRef.current = onLink;
  });

  useEffect(() => {
    const stored = (() => {
      try {
        return sessionStorage.getItem(HERO_LINK_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (stored) handlerRef.current(stored);

    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') handlerRef.current(detail);
    };
    window.addEventListener(HERO_LINK_EVENT, onEvent);
    return () => window.removeEventListener(HERO_LINK_EVENT, onEvent);
  }, []);
}
