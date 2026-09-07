// The Thread marketing site — its own root layout, deliberately NOT the
// shared createRootLayout(): no ThemeScript (light-only is the brand), a
// real metadataBase, and a proper title template (the P5 favicon/OG gap
// closes on this surface via app/icon.svg + opengraph-image.tsx).

import './globals.css';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://thethread.app'),
  title: { default: 'The Thread — for weaving the social fabric', template: '%s · The Thread' },
  description:
    'Every gathering is a beginning. The Thread carries it forward — enrolment, payments, messages, certificates: the whole arc, considered.',
  openGraph: {
    type: 'website',
    siteName: 'The Thread',
    locale: 'en',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
