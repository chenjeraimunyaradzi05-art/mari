'use client';

/**
 * App Providers Wrapper
 * Phase 3: Web Client - Super App Core
 * 
 * Combines all providers for the application:
 * - Theme (dark mode)
 * - Announcements (screen reader)
 * - Keyboard shortcuts
 * - Query client
 */

import React from 'react';
import { ThemeProvider, ThemeScript } from './ThemeProvider';
import { AnnouncementProvider, KeyboardShortcutsProvider } from '@/lib/accessibility';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <>
      <ThemeScript />
      <ThemeProvider
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
      >
        <KeyboardShortcutsProvider>
          <AnnouncementProvider>
            {children}
          </AnnouncementProvider>
        </KeyboardShortcutsProvider>
      </ThemeProvider>
    </>
  );
}

export default AppProviders;
