import { APP_VIEWPORT } from '@thefibre/shared/root-layout';
import type { Metadata } from 'next';
import './globals.css';
import { SURFACES } from '@thefibre/shared';
import { loadSession } from '@/lib/session';
import { VERSION } from '@/lib/version';
import { MemberRail, MemberTabs } from './nav';

// iOS needs its own tags — Safari reads very little of app/manifest.ts. It
// takes the home-screen icon from `apple-touch-icon`, decides whether to open
// without browser chrome from `appleWebApp.capable`, and uses its own title.
// Without these, "Add to Home Screen" on an iPhone (or "Add to Dock" on a Mac)
// produces a bookmark that opens a browser tab, which is the thing this exists
// to avoid. Same shape as apps/connections and apps/web.
export const metadata: Metadata = {
  title: SURFACES['my-portal'].shortLabel,
  description: SURFACES['my-portal'].tagline,
  // From the registry, not typed here: a second copy is how the icon's name
  // and the app's name end up disagreeing after a rename.
  applicationName: SURFACES['my-portal'].shortLabel,
  appleWebApp: {
    capable: true,
    title: SURFACES['my-portal'].shortLabel,
    // `default` keeps the status bar legible against the white page.
    // `black-translucent` would draw under it and needs safe-area padding
    // this shell does not have.
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
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

export const viewport = APP_VIEWPORT;
