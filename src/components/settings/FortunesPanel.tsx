'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';
import { Fortune } from '@/lib/fortunes';

interface DraftFortune {
  id: number;
  text: string;
  author: string;
}

export default function FortunesPanel() {
  const [items, setItems] = React.useState<DraftFortune[]>([]);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [state, setState] = React.useState<'idle' | 'loading' | 'saving' | 'saved'>('loading');
  const [usingDefaults, setUsingDefaults] = React.useState(false);
  const [savedSnapshot, setSavedSnapshot] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const nextIdRef = React.useRef(0);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/fortunes');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { fortunes: Fortune[]; isDefault: boolean } = await res.json();
        if (!active) return;
        const items: DraftFortune[] = json.fortunes.map((f, i) => ({
          id: i,
          text: f.text,
          author: f.author ?? '',
        }));
        nextIdRef.current = json.fortunes.length;
        setItems(items);
        setSavedSnapshot(JSON.stringify(items));
        setUsingDefaults(json.isDefault);
        setState('idle');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (active) {
          setError(msg || 'Failed to load fortunes');
          setState('idle');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const patch = (id: number, patch: Partial<DraftFortune>) => {
    setItems(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
    setState('idle');
  };

  const add = () => {
    const id = nextIdRef.current++;
    setItems(prev => [...prev, { id, text: '', author: '' }]);
    setEditing(id);
    setState('idle');
  };

  const remove = (id: number) => {
    setItems(prev => prev.filter(f => f.id !== id));
    if (editing === id) setEditing(null);
    setState('idle');
  };

  const cancelEdit = (id: number) => {
    setEditing(null);
    setItems(prev => {
      const target = prev.find(f => f.id === id);
      if (target && !target.text.trim()) return prev.filter(f => f.id !== id);
      return prev;
    });
  };

  const dirty = JSON.stringify(items) !== savedSnapshot;

  const save = async () => {
    const fortunes: Fortune[] = items
      .filter(f => f.text.trim().length > 0)
      .map(f => ({
        text: f.text.trim(),
        ...(f.author.trim() ? { author: f.author.trim() } : {}),
      }));
    setState('saving');
    try {
      const res = await fetch('/api/fortunes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fortunes),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved: DraftFortune[] = fortunes.map((f, i) => ({
        id: i,
        text: f.text,
        author: f.author ?? '',
      }));
      setItems(saved);
      setSavedSnapshot(JSON.stringify(saved));
      setUsingDefaults(false);
      setError(null);
      setState('saved');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Failed to save fortunes');
      setState('idle');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
        Quotes shown on the Overview slide. Add, edit, or remove entries, then
        save — stored on the board (S3).
      </p>

      {items.map(f => (
        <div
          key={f.id}
          className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)] p-3"
        >
          {editing === f.id ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={f.text}
                onChange={e => patch(f.id, { text: e.target.value })}
                rows={2}
                placeholder="Quote"
                spellCheck={false}
                autoFocus
                className="w-full resize-y rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-high)] p-2 text-[14px] leading-relaxed text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)]"
              />
              <input
                value={f.author}
                onChange={e => patch(f.id, { author: e.target.value })}
                placeholder="Author (optional)"
                spellCheck={false}
                className="w-full rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-high)] p-2 text-[14px] text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)]"
              />
              <div className="flex justify-end gap-2">
                <md-text-button
                  onClick={() => cancelEdit(f.id)}
                  suppressHydrationWarning
                >
                  Cancel
                </md-text-button>
                <md-filled-button
                  onClick={() => setEditing(null)}
                  disabled={!f.text.trim()}
                  suppressHydrationWarning
                >
                  Done
                </md-filled-button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[var(--md-sys-color-on-surface)]">
                  {f.text}
                </p>
                {f.author && (
                  <p className="mt-0.5 text-[12px] text-[var(--md-sys-color-on-surface-variant)]">
                    — {f.author}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <md-icon-button
                  aria-label="Edit fortune"
                  onClick={() => setEditing(f.id)}
                  suppressHydrationWarning
                >
                  <md-icon>edit</md-icon>
                </md-icon-button>
                <md-icon-button
                  aria-label="Delete fortune"
                  onClick={() => remove(f.id)}
                  suppressHydrationWarning
                >
                  <md-icon>delete</md-icon>
                </md-icon-button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <md-text-button onClick={add} suppressHydrationWarning>
          <md-icon slot="icon">add</md-icon>
          Add fortune
        </md-text-button>
        <span className="md-typescale-label-small text-[var(--md-sys-color-on-surface-variant)]">
          {usingDefaults
            ? 'Showing built-in defaults — save to override.'
            : state === 'saved'
              ? 'Saved to the board store.'
              : ''}
        </span>
      </div>

      {error && (
        <p className="md-typescale-body-medium text-[var(--md-sys-color-error)]">{error}</p>
      )}

      <div className="flex justify-end border-t border-[var(--md-sys-color-outline-variant)] pt-3">
        <md-filled-button
          onClick={save}
          disabled={!dirty || state === 'saving'}
          suppressHydrationWarning
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </md-filled-button>
      </div>
    </div>
  );
}