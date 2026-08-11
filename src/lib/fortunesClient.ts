/**
 * Client-side fortune cache (localStorage). The Overview slide picks from
 * the cache instantly on round start, then refreshes the list from the API
 * in the background — no network wait before the quote shows.
 */

import { Fortune } from './fortunes';

export const FORTUNES_CACHE_KEY = 'gitdash_fortunes_cache';

/** Cached list, or null when nothing is cached yet (never a network call). */
export function readCachedFortunes(): Fortune[] | null {
  try {
    const raw = localStorage.getItem(FORTUNES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (f): f is Fortune =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as Fortune).text === 'string' &&
        (f as Fortune).text.trim().length > 0
    );
  } catch {
    return null;
  }
}

export function cacheFortunes(fortunes: Fortune[]): void {
  try {
    localStorage.setItem(FORTUNES_CACHE_KEY, JSON.stringify(fortunes));
  } catch {
    // Ignore; the quote simply re-fetches next round.
  }
}

export function pickFortune(fortunes: Fortune[]): Fortune {
  return fortunes[Math.floor(Math.random() * fortunes.length)];
}
