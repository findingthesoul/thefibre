import type { Metadata } from 'next';
import './globals.css';
import { ThemeScript } from '@/components/shell/theme-script';
import { APPS } from '@thefibre/shared';

export const metadata: Metadata = {
  title: APPS['fibre-flow'].name,
  description: APPS['fibre-flow'].tagline,
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
