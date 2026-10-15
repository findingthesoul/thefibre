// `/my` IS A DOOR, NOT A ROOM — the Thread app's twin of what the Members
// app's `/my` became on 2026-10-14.
//
// This was Thread's own participant page: sign in, see the threads you are
// enrolled in. my.thread does that and more — the same threads with their
// sessions, tickets, certificates and invoices, across every app — and two
// personal pages for one person is a choice nobody should have to make (one
// member portal, Sjoerd's rule). It also carried the last private copy of a
// thread's date formatting (thread dates slice 4, 2026-10-16), which is how
// it was noticed: polishing it would have kept the second page alive.
//
// So this redirects, and does NOT 404: the address is in sent emails
// (thread.ts `threadUrl: …/my`), in the enrol form's "Sign in to your
// personal page" link, and in bookmarks, and those keep working.

import { redirect } from 'next/navigation';
import { surfaceUrl } from '@thefibre/shared';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function MyRedirect() {
  // The stack comes from the request, never a constant: `surfaceUrl` reads
  // the env var when there is one and falls back to the host that served
  // this page, so staging sends people to staging's my.thread.
  const host = (await headers()).get('host');
  redirect(surfaceUrl('my-portal', process.env, host));
}
