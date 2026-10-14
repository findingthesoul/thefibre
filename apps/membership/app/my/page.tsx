// `/my` IS NOW A DOOR, NOT A ROOM.
//
// This was the Members app's own member page: sign in, see every membership
// held under your email. my.thread does that and more — memberships,
// purchases, the people you can see, your own details and your calendar
// subscription, across every app rather than this one. Two personal pages for
// one person is a choice nobody should have to make, and the one with less on
// it was winning, because it is the address the emails had been sending
// people to.
//
// So this redirects, and does NOT 404: the address is in sent emails, in
// bookmarks and in Stripe's stored success URLs, and those keep working.
//
// Sjoerd, 2026-10-14, after being landed here by an invitation email while
// testing: he was looking at the thinner page and wondering where everything
// was.

import { redirect } from 'next/navigation';
import { surfaceUrl } from '@thefibre/shared';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function MyRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // THE STACK COMES FROM THE REQUEST, not from a constant. A hand-built URL
  // here is how a staging page has sent somebody to production before:
  // `surfaceUrl` reads the env var when there is one and falls back to the
  // host that served this page.
  const host = (await headers()).get('host');
  const portal = surfaceUrl('my-portal', process.env, host);

  // `?paid=success` and `?paid=cancelled` arrive from Stripe's stored
  // success_url on payment links that are already out in the world. They are
  // carried across rather than dropped — the member came back from paying and
  // the page they land on should know it.
  const sp = await searchParams;
  const paid = typeof sp.paid === 'string' ? sp.paid : null;
  redirect(`${portal}/memberships${paid ? `?paid=${encodeURIComponent(paid)}` : ''}`);
}
