import type { Metadata } from 'next';
import './globals.css';
import { SURFACES } from '@thefibre/shared';
import { loadSession } from '@/lib/session';
import { VERSION } from '@/lib/version';
import { MemberRail, MemberTabs } from './nav';

export const metadata: Metadata = {
  title: SURFACES['my-portal'].shortLabel,
  description: SURFACES['my-portal'].tagline,
  // Never index this surface. Every page below the sign-in is one person's
  // own tickets, enrolments and memberships — the most personal data the
  // platform holds, on the only app whose entire purpose is to show it to
  // its subject. Same posture as the embed layouts in Thread and Membership.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The chrome only exists for someone who is signed in. A signed-out visitor
  // gets one page with one thing on it, and four tabs leading to four copies
  // of that same sign-in form would be noise.
  const session = await loadSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-dvh antialiased bg-surface text-ink">
        {session ? (
          <div className="flex h-full">
            <MemberRail />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex-1 overflow-y-auto">{children}</main>
              <MemberTabs version={VERSION} />
            </div>
          </div>
        ) : (
          <main className="h-full overflow-y-auto">{children}</main>
        )}
      </body>
    </html>
  );
}
