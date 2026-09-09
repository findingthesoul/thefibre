// GET /ics/:threadId/:itemId — one agenda item as a calendar file.
//
// Why this lives in the portal and not the API: an "Add to calendar" control
// is a plain link, and a plain link cannot carry a bearer token. This route
// handler runs on the server with the session cookie, re-reads the portal
// with the same call the page makes, and finds the item inside the payload.
// So the file is scoped to the signed-in person by construction — there is
// no new way to address someone else's agenda, because the lookup only ever
// searches what this person can already see.
//
// The .ics itself is built by @thefibre/shared/ical, the same builder Meet
// uses for bookings (lifted there in v0.68.28). One definition, no copies.

import { buildBookingIcal } from '@thefibre/shared/ical';
import { ENTITY } from '@thefibre/shared';
import { serverSupabase } from '@/lib/supabase/server';
import { fetchPortal } from '@/lib/portal-api';

export const dynamic = 'force-dynamic';

/** An agenda item with a start but no end: an hour is the least surprising
 *  guess, and a calendar entry with no duration renders inconsistently. */
const DEFAULT_MINUTES = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string; itemId: string }> },
) {
  const { threadId, itemId } = await params;

  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response('Sign in required', { status: 401 });

  let portal;
  try {
    portal = await fetchPortal(session.access_token);
  } catch {
    return new Response('Could not read your portal', { status: 502 });
  }

  const thread = portal.groups
    .flatMap((g) => g.threads)
    .find((t) => t.thread_id === threadId);
  const item = thread?.agenda.find((a) => a.id === itemId);

  // Same answer for "does not exist" and "not yours": the search space is
  // already this person's, so a 404 leaks nothing either way.
  if (!thread || !item || !item.starts_at) {
    return new Response('Not found', { status: 404 });
  }

  const startsAt = new Date(item.starts_at);
  const endsAt = item.ends_at
    ? new Date(item.ends_at)
    : new Date(startsAt.getTime() + DEFAULT_MINUTES * 60_000);

  const ics = buildBookingIcal({
    // Stable, so re-adding updates the entry rather than duplicating it.
    uid: `agenda-${item.id}@thefibre`,
    prodId: `-//${ENTITY.publicName}//Portal//EN`,
    startsAt,
    endsAt,
    summary: item.title,
    // The thread is the context a calendar entry loses otherwise: three
    // months later "Opening circle" alone means nothing.
    description: [item.description, thread.title].filter(Boolean).join('\n\n'),
    location: item.location,
    url: item.meeting_url ?? item.external_url ?? thread.url,
    attendeeName:
      [portal.person.first_name, portal.person.last_name].filter(Boolean).join(' ') || null,
    attendeeEmail: portal.person.email,
  });

  const filename = `${item.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'event'}.ics`;

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
