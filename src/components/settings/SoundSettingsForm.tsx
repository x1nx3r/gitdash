'use client';

import * as React from 'react';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/divider/divider.js';
import M3Switch from '@/components/notifications/M3Switch';
import M3Slider from '@/components/notifications/M3Slider';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { NotificationEventType, NotificationSettings, ToneId } from '@/types/notifications';

const EVENT_LABELS: Record<NotificationEventType, string> = {
  new_pr: 'New PR',
  ready_to_merge: 'Ready to merge',
  merged: 'PR merged',
  changes_requested: 'Changes requested',
};

const TONES: { id: ToneId; label: string }[] = [
  { id: 'chime', label: 'Chime' },
  { id: 'bell', label: 'Bell' },
  { id: 'pop', label: 'Pop' },
  { id: 'none', label: 'Off' },
];

interface SoundSettingsFormProps {
  value: NotificationSettings;
  onChange: (next: NotificationSettings) => void;
}

export default function SoundSettingsForm({ value, onChange }: SoundSettingsFormProps) {
  const { configured } = useNotifications();

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

          <div>
            <span className="md-typescale-label-medium text-[var(--md-sys-color-on-surface)]">
              Sound
            </span>
            <md-chip-set className="mt-2">
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
          </div>

          <md-divider></md-divider>

          <div className="flex flex-col">
            <span className="md-typescale-title-small mb-3 text-[var(--md-sys-color-on-surface)]">
              Events
            </span>
            <div className="flex flex-col gap-4">
              {(Object.keys(EVENT_LABELS) as NotificationEventType[]).map(type => (
                <div key={type} className="flex items-center justify-between gap-3">
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
                    ariaLabel={EVENT_LABELS[type]}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
