'use client';

import * as React from 'react';
import { readZoom, subscribeZoom } from '@/lib/zoom';

/**
 * Applies the manual zoom factor as CSS `zoom` on <html>. Unlike transform
 * scaling, zoom reflows layout, so overflowing content scrolls exactly like
 * a real browser zoom and no wrapper or viewport measurement is needed.
 */
export default function ZoomScale() {
  const zoom = React.useSyncExternalStore(subscribeZoom, readZoom, () => 1);

  React.useEffect(() => {
    const root = document.documentElement;
    if (zoom === 1) root.style.zoom = '';
    else root.style.zoom = String(zoom);
  }, [zoom]);

  return null;
}
