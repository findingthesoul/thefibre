// The six apps' root layouts were byte-identical except the APPS slug in
// their metadata (component-inventory.md Phase 4). What CANNOT move here is
// each app's `import './globals.css'` — Next requires the CSS import in the
// app's own layout file — so an app's layout.tsx becomes:
//
//   import './globals.css';
//   import { appMetadata, createRootLayout } from '@thefibre/shared/root-layout';
//   export const metadata = appMetadata('fibre-meet');
//   export default createRootLayout();
//
// appMetadata's return type is structural, not next's Metadata — shared has
// no next dependency (house rule); the shape is a subset Next accepts.

import type { ReactNode } from 'react';
import { ThemeScript } from './ui/theme-script.js';
import { APPS } from './branding.js';
import type { AppId } from './index.js';

export function appMetadata(slug: AppId): { title: string; description: string } {
  return { title: APPS[slug].name, description: APPS[slug].tagline };
}

export function createRootLayout() {
  return function RootLayout({ children }: { children: ReactNode }) {
    return (
      <html lang="en" suppressHydrationWarning>
        <head>
          <ThemeScript />
        </head>
        <body className="min-h-screen antialiased bg-surface text-ink">{children}</body>
      </html>
    );
  };
}
