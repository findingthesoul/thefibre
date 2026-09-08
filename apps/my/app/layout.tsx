import type { Metadata } from 'next';
import './globals.css';
import { SURFACES } from '@thefibre/shared';

export const metadata: Metadata = {
  title: SURFACES['my-portal'].shortLabel,
  description: SURFACES['my-portal'].tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-surface text-ink">{children}</body>
    </html>
  );
}
