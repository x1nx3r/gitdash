import { ToneId } from '@/types/notifications';

let ctx: AudioContext | null = null;

let blocked = false;
const blockedListeners = new Set<() => void>();

function setBlocked(value: boolean): void {
  if (blocked === value) return;
  blocked = value;
  for (const l of blockedListeners) l();
}

/** True when the AudioContext exists but autoplay policy keeps it suspended. */
export function isSoundBlocked(): boolean {
  return blocked;
}

/** Subscribe to sound-blocked changes; returns an unsubscribe function. */
export function subscribeSoundBlocked(listener: () => void): () => void {
  blockedListeners.add(listener);
  return () => blockedListeners.delete(listener);
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** True when this browser has no AudioContext at all (rare, mostly TVs). */
export function isAudioUnsupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.AudioContext && !(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** Call from a user gesture to satisfy the autoplay policy. */
export function unlockAudio(): void {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') {
    setBlocked(true);
    void c.resume().then(
      () => setBlocked(false),
      () => setBlocked(true)
    );
  } else {
    setBlocked(false);
  }
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gainVal: number,
  type: OscillatorType = 'sine'
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  const t0 = c.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(gainVal, 0.0001), t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const TONES: Record<Exclude<ToneId, 'none'>, (c: AudioContext, v: number) => void> = {
  chime: (c, v) => {
    tone(c, 880, 0, 0.5, v);
    tone(c, 1318, 0.12, 0.6, v * 0.8);
  },
  bell: (c, v) => {
    tone(c, 660, 0, 0.8, v, 'triangle');
    tone(c, 990, 0.02, 0.5, v * 0.5);
  },
  pop: (c, v) => {
    tone(c, 440, 0, 0.16, v);
  },
};

export function playSound(id: ToneId, volume: number): void {
  if (id === 'none' || volume <= 0) return;
  const c = getContext();
  if (!c) {
    setBlocked(true);
    return;
  }
  if (c.state === 'suspended') {
    setBlocked(true);
    void c.resume().catch(() => {});
  } else {
    setBlocked(false);
  }
  TONES[id](c, Math.min(1, Math.max(0, volume)));
}
