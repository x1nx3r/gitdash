'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import PRCard from './PRCard';
import { KanbanColumns } from '@/types/github';
import { readZoom, subscribeZoom } from '@/lib/zoom';

interface KanbanBoardProps {
  columns: KanbanColumns;
}

interface ColumnConfig {
  key: keyof KanbanColumns;
  title: string;
  iconName: string;
  accent: string;
  tone: 'primary' | 'error' | 'secondary' | 'success';
}

const columnConfigs: ColumnConfig[] = [
  {
    key: 'needs_review',
    title: 'Needs review',
    iconName: 'rate_review',
    accent: 'var(--md-sys-color-primary)',
    tone: 'primary',
  },
  {
    key: 'changes_requested',
    title: 'Changes requested',
    iconName: 'rate_review_off',
    accent: 'var(--md-sys-color-error)',
    tone: 'error',
  },
  {
    key: 'ready_to_merge',
    title: 'Ready to merge',
    iconName: 'rocket_launch',
    accent: 'var(--md-sys-color-secondary)',
    tone: 'secondary',
  },
  {
    key: 'merged_today',
    title: 'Merged today',
    iconName: 'merge',
    accent: 'var(--md-sys-color-success)',
    tone: 'success',
  },
];

const TONE_CONTAINER: Record<ColumnConfig['tone'], string> = {
  primary: 'var(--md-sys-color-primary-container)',
  error: 'var(--md-sys-color-error-container)',
  secondary: 'var(--md-sys-color-secondary-container)',
  success: 'var(--md-sys-color-success-container)',
};

const TONE_ON_CONTAINER: Record<ColumnConfig['tone'], string> = {
  primary: 'var(--md-sys-color-on-primary-container)',
  error: 'var(--md-sys-color-on-error-container)',
  secondary: 'var(--md-sys-color-on-secondary-container)',
  success: 'var(--md-sys-color-on-success-container)',
};

function getWidth(): number | null {
  return typeof window === 'undefined' ? null : window.innerWidth;
}

function subscribeWidth(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

export default function KanbanBoard({ columns }: KanbanBoardProps) {
  // Breakpoints must see the zoom-adjusted viewport: CSS zoom does not
  // re-evaluate media queries, so 0.5x would never flip the grid to 4
  // columns the way browser zoom does. Effective width = real / zoom.
  const zoom = React.useSyncExternalStore(subscribeZoom, readZoom, () => 1);
  const width = React.useSyncExternalStore(subscribeWidth, getWidth, () => null);
  const effectiveW = width !== null ? width / zoom : 0;
  const cols = effectiveW >= 1280 ? 4 : effectiveW >= 640 ? 2 : 1;

  // Deterministic per-PR entry tilt so cards land at slightly different
  // angles; springs do the rest of the "jumpy" work.
  const tilt = (id: string | number) => (Number(id) % 5) * 3 - 6;

  const spring = {
    type: 'spring',
    stiffness: 260,
    damping: 14,
  } as const;

  return (
    <LayoutGroup>
      <div
        className="grid h-full grid-cols-1 gap-5 p-5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {columnConfigs.map(col => {
          const prs = columns[col.key] || [];

          return (
            <section
              key={col.key}
              className="flex min-h-[70vh] flex-col rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] p-4"
            >
            {/* Column header */}
            <header className="mb-4 flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-high)] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <md-icon
                  style={{ fontSize: '20px', color: col.accent }}
                  suppressHydrationWarning
                >
                  {col.iconName}
                </md-icon>
                <h2 className="md-typescale-title-small text-[var(--md-sys-color-on-surface)]">
                  {col.title}
                </h2>
              </div>
              <span
                className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 md-typescale-label-medium tabular-nums"
                style={{
                  backgroundColor: TONE_CONTAINER[col.tone],
                  color: TONE_ON_CONTAINER[col.tone],
                }}
              >
                {prs.length}
              </span>
            </header>

            {/* PR list */}
            <div className="flex flex-1 flex-col gap-3">
              {prs.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] border border-dashed border-[var(--md-sys-color-outline-variant)] p-4 md-typescale-body-medium text-[var(--md-sys-color-outline)]">
                  No items
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {prs.map(pr => (
                    <motion.div
                      key={pr.id}
                      layout
                      initial={{ opacity: 0, scale: 1.2, rotate: tilt(pr.id), y: 24 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                      exit={{ opacity: 0, scale: 1.25, rotate: -tilt(pr.id), transition: { duration: 0.18 } }}
                      transition={spring}
                    >
                      <PRCard pr={pr} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
        );
      })}
      </div>
    </LayoutGroup>
  );
}
