'use client';

import * as React from 'react';
import '@material/web/icon/icon.js';
import '@material/web/labs/card/elevated-card.js';
import '@material/web/divider/divider.js';
import { PullRequest } from '@/types/github';

interface PRCardProps {
  pr: PullRequest;
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  return `${Math.floor(diffInHours / 24)}d`;
}

const REVIEWER_RING = {
  APPROVED: 'var(--md-sys-color-success)',
  CHANGES_REQUESTED: 'var(--md-sys-color-error)',
  PENDING: 'var(--md-sys-color-outline)',
} as const;

export default function PRCard({ pr }: PRCardProps) {
  const timeAgo = getTimeAgo(pr.createdAt);
  const { additions, deletions, changedFiles } = pr.stats;

  return (
    <md-elevated-card
      className={pr.isStale ? 'ring-1 ring-inset ring-[var(--md-sys-color-warning-container)]' : ''}
      style={
        pr.isStale
          ? {
              '--md-elevated-card-container-color':
                'var(--md-sys-color-surface-container-highest)',
            } as React.CSSProperties
          : undefined
      }
    >
      <div className="flex flex-col gap-3 p-4">
        {/* Card header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pr.author.avatarUrl}
              alt={pr.author.login}
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
            <span className="truncate md-typescale-label-medium text-[var(--md-sys-color-primary)]">
              {pr.repository.name}
            </span>
            <span className="md-typescale-label-medium text-[var(--md-sys-color-outline)]">
              #{pr.number}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 md-typescale-label-medium text-[var(--md-sys-color-outline)]">
            <md-icon style={{ fontSize: '16px' }} suppressHydrationWarning>
              schedule
            </md-icon>
            {timeAgo}
          </span>
        </div>

        {/* PR title */}
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block leading-snug text-[var(--md-sys-color-on-surface)] transition-colors hover:text-[var(--md-sys-color-primary)] md-typescale-title-small line-clamp-2"
        >
          {pr.title}
        </a>

        {pr.isStale && (
          <div className="inline-flex items-center gap-1 self-start rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-warning-container)] px-2 py-0.5 md-typescale-label-small text-[var(--md-sys-color-on-warning-container)]">
            <md-icon style={{ fontSize: '14px' }} suppressHydrationWarning>
              schedule
            </md-icon>
            Stale
          </div>
        )}

        <md-divider></md-divider>

        {/* Footer strip */}
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 md-typescale-label-medium text-[var(--md-sys-color-on-surface-variant)]">
            <md-icon style={{ fontSize: '16px' }} suppressHydrationWarning>
              code
            </md-icon>
            <span className="text-[var(--md-sys-color-success)]">
              +{additions.toLocaleString()}
            </span>
            <span className="text-[var(--md-sys-color-error)]">
              −{deletions.toLocaleString()}
            </span>
            <span className="text-[var(--md-sys-color-outline)]">·</span>
            <span className="inline-flex items-center gap-0.5">
              <md-icon style={{ fontSize: '16px' }} suppressHydrationWarning>
                description
              </md-icon>
              {changedFiles} files
            </span>
          </span>

          {pr.reviewers.length > 0 && (
            <div className="flex -space-x-1.5">
              {pr.reviewers.map((rev, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={rev.avatarUrl}
                  alt={rev.login}
                  title={`@${rev.login} (${rev.state})`}
                  className="h-5 w-5 rounded-full object-cover ring-2"
                  style={{ '--tw-ring-color': REVIEWER_RING[rev.state] } as React.CSSProperties}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </md-elevated-card>
  );
}
