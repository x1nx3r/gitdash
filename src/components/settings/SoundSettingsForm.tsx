'use client';

import * as React from 'react';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/divider/divider.js';
import '@material/web/icon/icon.js';
import M3Switch from '@/components/notifications/M3Switch';
import M3Slider from '@/components/notifications/M3Slider';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { invalidateCustomSound, playCustomSound, playSound } from '@/lib/soundEngine';
import {
  NotificationEventType,
  NotificationSettings,
  SoundLibraryEntry,
  ToneId,
} from '@/types/notifications';

const EVENT_LABELS: Record<NotificationEventType, string> = {
  new_pr: 'New PR',
  ready_to_merge: 'Ready to merge',
  merged: 'PR merged',
  changes_requested: 'Changes requested',
};

const EVENT_TYPES = Object.keys(EVENT_LABELS) as NotificationEventType[];

const TONES: { id: ToneId; label: string }[] = [
  { id: 'chime', label: 'Chime' },
  { id: 'bell', label: 'Bell' },
  { id: 'pop', label: 'Pop' },
  { id: 'none', label: 'Off' },
];

interface SoundSettingsFormProps {
  value: NotificationSettings;
  onChange: (next: NotificationSettings) => void;
  sounds: SoundLibraryEntry[];
  onUpload: (file: File) => Promise<SoundLibraryEntry | null>;
}

export default function SoundSettingsForm({
  value,
  onChange,
  sounds,
  onUpload,
}: SoundSettingsFormProps) {
  const { configured } = useNotifications();
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const preview = async (type: NotificationEventType) => {
    const custom = value.customSounds?.[type];
    if (custom?.id) {
      const ok = await playCustomSound(
        `/api/sound-library/${encodeURIComponent(custom.id)}`,
        value.volume
      );
      if (!ok) playSound(value.sound, value.volume);
    } else {
      playSound(value.sound, value.volume);
    }
  };

  const assign = (type: NotificationEventType, id: string) => {
    if (id) {
      const entry = sounds.find(s => s.id === id);
      if (!entry) return;
      onChange({
        ...value,
        customSounds: { ...value.customSounds, [type]: { id, name: entry.name } },
      });
    } else {
      const existing = value.customSounds?.[type];
      if (existing) {
        invalidateCustomSound(`/api/sound-library/${existing.id}`);
      }
      onChange({
        ...value,
        customSounds: { ...value.customSounds, [type]: null },
      });
    }
  };

  const uploadToLibrary = async (file: File, type: NotificationEventType) => {
    setError(null);
    if (!file.type.startsWith('audio/')) {
      setError('Only audio files are accepted');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('File is too large (max 2 MB)');
      return;
    }
    setUploading(true);
    try {
      const entry = await onUpload(file);
      if (entry) assign(type, entry.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {!configured && (
        <div className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)] px-3 py-2 md-typescale-body-small text-[var(--md-sys-color-on-surface-variant)]">
          Notifications are off: set GITHUB_WEBHOOK_SECRET and point the GitHub
          webhook at /api/webhooks/github to enable them.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
          Notification sound
        </span>
        <M3Switch
          checked={value.enabled}
          onCheckedChange={enabled => onChange({ ...value, enabled })}
          ariaLabel="Notification sound"
        />
      </div>

      {value.enabled && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="md-typescale-label-medium text-[var(--md-sys-color-on-surface)]">
                Volume
              </span>
              <span className="md-typescale-label-medium text-[var(--md-sys-color-on-surface-variant)] tabular-nums">
                {Math.round(value.volume * 100)}%
              </span>
            </div>
            <M3Slider
              value={value.volume}
              min={0}
              max={1}
              step={0.05}
              ariaLabel="Notification volume"
              onValueChange={volume => onChange({ ...value, volume })}
            />
          </div>

          <md-divider></md-divider>

          <div className="flex flex-col">
            <span className="md-typescale-title-small mb-3 text-[var(--md-sys-color-on-surface)]">
              Events
            </span>
            <div className="flex flex-col gap-4">
              {EVENT_TYPES.map(type => {
                const custom = value.customSounds?.[type];
                return (
                  <div
                    key={type}
                    className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="md-typescale-body-medium text-[var(--md-sys-color-on-surface)]">
                        {EVENT_LABELS[type]}
                      </span>
                      <M3Switch
                        checked={value.events[type]}
                        onCheckedChange={() =>
                          onChange({
                            ...value,
                            events: { ...value.events, [type]: !value.events[type] },
                          })
                        }
                        ariaLabel={`${EVENT_LABELS[type]} notifications`}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <md-chip-set>
                        {TONES.map(tone => (
                          <md-filter-chip
                            key={tone.id}
                            label={tone.label}
                            selected={value.sound === tone.id}
                            onClick={() => onChange({ ...value, sound: tone.id })}
                            suppressHydrationWarning
                          ></md-filter-chip>
                        ))}
                      </md-chip-set>

                      <div className="relative min-w-[150px] flex-1">
                        <select
                          value={custom?.id ?? ''}
                          onChange={e => assign(type, e.target.value)}
                          aria-label={`Custom sound for ${EVENT_LABELS[type]}`}
                          className="w-full appearance-none rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-high)] py-1.5 pl-3 pr-8 text-[13px] text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)]"
                        >
                          <option value="">Custom: none</option>
                          {custom && !sounds.some(s => s.id === custom.id) && (
                            <option value={custom.id}>{custom.name} (removed)</option>
                          )}
                          {sounds.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <md-icon
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '18px',
                            color: 'var(--md-sys-color-outline)',
                            pointerEvents: 'none',
                          }}
                        >
                          expand_more
                        </md-icon>
                      </div>

                      <button
                        type="button"
                        onClick={() => void preview(type)}
                        aria-label={`Preview ${EVENT_LABELS[type]} sound`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                      >
                        <md-icon style={{ fontSize: '18px' }}>play_circle</md-icon>
                      </button>
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[var(--md-sys-color-primary)] md-typescale-label-large hover:bg-[var(--md-sys-color-surface-container-high)]">
                        <md-icon style={{ fontSize: '18px' }}>add_circle</md-icon>
                        {uploading ? 'Uploading…' : 'Add to library'}
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) void uploadToLibrary(file, type);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="md-typescale-body-medium text-[var(--md-sys-color-error)]">{error}</p>
      )}
    </div>
  );
}