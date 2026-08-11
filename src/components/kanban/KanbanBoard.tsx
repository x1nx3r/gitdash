'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import PRCard from './PRCard';
import { KanbanColumns } from '@/types/github';

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

export default function KanbanBoard({ columns }: KanbanBoardProps) {
  return (
    <div className="grid h-full grid-cols-1 gap-5 p-5 sm:grid-cols-2 xl:grid-cols-4">
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
                prs.map(pr => <PRCard key={pr.id} pr={pr} />)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
