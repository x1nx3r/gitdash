'use client';

import * as React from 'react';
import { RepoProvider } from '@/components/repos/RepoProvider';
import { NotificationProvider } from './NotificationProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RepoProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </RepoProvider>
  );
}
