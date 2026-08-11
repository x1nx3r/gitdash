export const THEME_STORAGE_KEY = 'gitdash_theme';

export interface ThemeOption {
  id: string;
  label: string;
  description: string;
  /** Accent chips shown in the settings picker. */
  swatch: string[];
}

export const THEMES: ThemeOption[] = [
  {
    id: 'default',
    label: 'GitDash',
    description: 'Material 3 soft sky blue',
    swatch: ['#a9c7ff', '#bfc6dc', '#d9bfe7', '#ffb4ab', '#c6ecc7', '#ffdf9e'],
  },
  {
    id: 'rosepine',
    label: 'Rosé Pine Moon',
    description: 'Muted warm dark, low glare',
    swatch: ['#c4a7e7', '#9ccfd8', '#ea9a97', '#eb6f92', '#8fc4d4', '#f6c177'],
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin Mocha',
    description: 'Cool dark, saturated accents',
    swatch: ['#89b4fa', '#cba6f7', '#94e2d5', '#f38ba8', '#a6e3a1', '#f9e2af'],
  },
  {
    id: 'solarized',
    label: 'Solarized Dark',
    description: 'Classic low-glare cyan and blue',
    swatch: ['#268bd2', '#2aa198', '#6c71c4', '#dc322f', '#859900', '#b58900'],
  },
];

export function isValidTheme(id: string | null | undefined): id is string {
  return typeof id === 'string' && THEMES.some(t => t.id === id);
}

/** Read the persisted theme id, falling back to the default. Client only. */
export function readTheme(): string {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(t) ? t : 'default';
  } catch {
    return 'default';
  }
}

/** Apply a theme id to <html> and persist it. Client only. */
export function applyTheme(id: string): void {
  const root = document.documentElement;
  if (id === 'default') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = id;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Ignore; the theme still applies for this session.
  }
  window.dispatchEvent(new Event('gitdash:theme-change'));
}

/**
 * React subscription for the theme store: fires on local changes and on
 * changes made in other tabs (storage event). Client only.
 */
export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('gitdash:theme-change' as keyof WindowEventMap, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('gitdash:theme-change' as keyof WindowEventMap, onChange);
  };
}
