export const ZOOM_KEY = 'gitdash_zoom';
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;

/** Manual zoom factor, applied as CSS zoom on <html> (browser-zoom style). */
export function readZoom(): number {
  try {
    const raw = Number(localStorage.getItem(ZOOM_KEY));
    if (!Number.isFinite(raw)) return 1;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw));
  } catch {
    return 1;
  }
}

/** Persist the zoom factor and notify subscribers. Client only. */
export function setZoom(zoom: number): void {
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch {
    // Ignore; applies for this session only.
  }
  window.dispatchEvent(new Event('gitdash:zoom-change'));
}

/** React subscription for the zoom factor. Client only. */
export function subscribeZoom(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('gitdash:zoom-change' as keyof WindowEventMap, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('gitdash:zoom-change' as keyof WindowEventMap, onChange);
  };
}
