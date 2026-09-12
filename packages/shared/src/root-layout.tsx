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
import { APPS, appUrl } from './branding.js';
import type { AppId } from './index.js';

/**
 * `metadataBase` is what turns a relative `opengraph-image` into the absolute
 * URL a link-preview scraper can actually fetch. Without it Next warns at
 * build and falls back to localhost, so a pasted link shows no picture at
 * all — which is how The Thread's public pages went a year with bare grey
 * cards (Sjoerd, 2026-09-12). Derived from `appUrl`, so it follows the env
 * per deployment and nobody hand-writes a domain (house rule 7).
 */
export function appMetadata(
  slug: AppId,
  /** Pass `process.env` so a staging deployment points at itself. Omitted,
   *  the registry's production URL is used — right in production, and
   *  harmless anywhere a link preview is not being scraped. This package
   *  has no node types on purpose, so it cannot read the environment
   *  itself. */
  env?: Record<string, string | undefined>,
): {
  title: string;
  description: string;
  metadataBase: URL;
} {
  return {
    title: APPS[slug].name,
    description: APPS[slug].tagline,
    metadataBase: new URL(appUrl(slug, env)),
  };
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
