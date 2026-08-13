let active = false;
const listeners = new Set<() => void>();

/** Whether the fullscreen slideshow is currently running. Client only. */
export function isSlideshowActive(): boolean {
  return active;
}

/** Set by the Slideshow component when it starts/stops. Client only. */
export function setSlideshowActive(value: boolean): void {
  if (active === value) return;
  active = value;
  listeners.forEach(l => l());
}

/** React subscription for slideshow active state. Client only. */
export function subscribeSlideshowActive(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}