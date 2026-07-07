import type { Metadata } from 'next';
import './globals.css';
import { ThemeScript } from '@/components/shell/theme-script';
import { APPS } from '@thefibre/shared';

export const metadata: Metadata = {
  title: APPS['fibre-pulse'].name,
  description: APPS['fibre-pulse'].tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased bg-surface text-ink">{children}</body>
    </html>
  );
}
