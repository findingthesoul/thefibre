import type { Metadata } from 'next';
import './globals.css';
import { ThemeScript } from '@/components/shell/theme-script';

export const metadata: Metadata = {
  title: 'Fibre Meet',
  description: 'Meeting platform — agenda, facilitation, outcomes.',
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
