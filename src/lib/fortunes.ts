/**
 * Programmer fortunes for the Overview slide. Stored as a flat JSON file
 * on S3 ("fortunes.json") — board-level, not per-user. When nothing is
 * stored (or S3 is not configured) the built-in defaults are used.
 * Server-only module: client components reach fortunes through the API.
 */

import { getJson, putJson } from './s3';

export interface Fortune {
  text: string;
  author?: string;
}

export const FORTUNES_S3_KEY = 'fortunes.json';

export const DEFAULT_FORTUNES: Fortune[] = [
  {
    text: 'Programs must be written for people to read, and only incidentally for machines to execute.',
    author: 'Abelson & Sussman',
  },
  {
    text: 'Simplicity is the soul of efficiency.',
    author: 'Austin Freeman',
  },
  {
    text: 'First, solve the problem. Then, write the code.',
    author: 'John Johnson',
  },
  {
    text: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.',
    author: 'Martin Fowler',
  },
  {
    text: 'Premature optimization is the root of all evil.',
    author: 'Donald Knuth',
  },
  {
    text: 'Talk is cheap. Show me the code.',
    author: 'Linus Torvalds',
  },
  {
    text: 'Debugging is twice as hard as writing the code in the first place.',
    author: 'Brian Kernighan',
  },
  {
    text: 'Make it work, make it right, make it fast.',
    author: 'Kent Beck',
  },
  {
    text: 'There are only two hard things in computer science: cache invalidation and naming things.',
    author: 'Phil Karlton',
  },
  {
    text: 'The most damaging phrase in the language is: "It\'s always done this way."',
    author: 'Grace Hopper',
  },
  {
    text: 'Measuring programming progress by lines of code is like measuring aircraft building progress by weight.',
    author: 'Bill Gates',
  },
  {
    text: 'The only way to learn a new programming language is by writing programs in it.',
    author: 'Dennis Ritchie',
  },
];

export function isFortune(value: unknown): value is Fortune {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Record<string, unknown>;
  return typeof f.text === 'string' && f.text.trim().length > 0;
}

/** S3-backed read: stored fortunes, else the built-in defaults. */
export async function getFortunes(): Promise<{
  fortunes: Fortune[];
  isDefault: boolean;
}> {
  const stored = await getJson<Fortune[]>(FORTUNES_S3_KEY);
  if (!stored) return { fortunes: DEFAULT_FORTUNES, isDefault: true };
  return { fortunes: stored.filter(isFortune), isDefault: false };
}

export async function saveFortunes(fortunes: Fortune[]): Promise<void> {
  await putJson(FORTUNES_S3_KEY, fortunes);
}
