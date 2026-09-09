import type { Metadata } from 'next';
import './globals.css';
import { SURFACES } from '@thefibre/shared';

export const metadata: Metadata = {
  title: SURFACES['my-portal'].shortLabel,
  description: SURFACES['my-portal'].tagline,
  // Never index this surface. Every page below the sign-in is one person's
  // own tickets, enrolments and memberships — the most personal data the
  // platform holds, on the only app whose entire purpose is to show it to
  // its subject. Same posture as the embed layouts in Thread and Membership.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-surface text-ink">{children}</body>
    </html>
  );
}
