// POST /api/join — a member joins a thread from the Upcoming list.
//
// It FORWARDS to POST /api/v1/thread/public/enrol, the same route the
// thread's own page submits to, and decides nothing itself. That route already
// verifies the bearer and prices the member by the function that charges
// them; a second enrol path here would be a second statement of the price,
// and the member who found the disagreement would have been charged by one
// and shown the other.
//
// What this handler adds is only what the browser must not hold: the access
// token, and the verified name and address from the portal — never a typed
// email, because the enrol route prices by the email it is given and checks
// it against the bearer.

import { POLICIES, policiesVersion } from '@thefibre/shared';
import { loadSession } from '@/lib/session';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(req: Request) {
  const session = await loadSession();
  if (!session) return json({ error: 'sign in required' }, 401);

  const b = (await req.json().catch(() => null)) as {
    owner_slug?: unknown;
    thread_slug?: unknown;
    request_id?: unknown;
    policy_accepted?: unknown;
  } | null;
  if (
    !b ||
    typeof b.owner_slug !== 'string' ||
    typeof b.thread_slug !== 'string' ||
    typeof b.request_id !== 'string'
  ) {
    return json({ error: 'owner_slug, thread_slug and request_id are required' }, 400);
  }
  // The box is ticked in the browser and checked again here: an acceptance
  // nobody gave must not be recorded because a client forgot to ask.
  if (b.policy_accepted !== true && POLICIES.some((p) => p.required)) {
    return json({ error: 'privacy policy agreement is required' }, 400);
  }

  const p = session.portal.person;
  const name =
    [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email.split('@')[0]!;

  const res = await fetch(`${baseUrl}/api/v1/thread/public/enrol`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organiser_slug: b.owner_slug,
      thread_slug: b.thread_slug,
      name,
      email: p.email,
      // Card unless the member chooses otherwise on the page. A thread that
      // takes invoices only answers 409 here, and the button then sends the
      // member to the page, where they can give billing details.
      payment_method: 'stripe',
      policy_accepted: true,
      policy_version: policiesVersion(),
      request_id: b.request_id,
    }),
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
