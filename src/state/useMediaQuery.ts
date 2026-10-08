import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query.
 *
 * Used so the tracker renders one layout at a time — a table on wide screens,
 * stacked cards on narrow ones — rather than shipping both and hiding one with
 * CSS. A single layout keeps the accessibility tree and the DOM unambiguous.
 *
 * Returns false when `matchMedia` is unavailable, which is also what jsdom
 * reports, so tests see the wide layout unless they say otherwise.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, [query]);

  return matches;
}

/** The breakpoint below which the tracker switches to stacked cards. */
export const COMPACT_TRACKER_QUERY = '(max-width: 767px)';
