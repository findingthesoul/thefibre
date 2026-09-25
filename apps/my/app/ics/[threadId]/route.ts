// GET /ics/:threadId — every dated session of one thread, in one file.
//
// Sjoerd, 2026-09-24: "what I want is that you can add individual events, and
// that you can add the sequence at once." The single-item route beside this
// one is the first half; this is the second. A programme of eight sessions
// was eight downloads, and nobody does eight downloads.
//
// This is a COPY, like any download: once these events are in someone's
// calendar they are theirs, and a later change here never reaches them. The
// subscription on the YOU page is the version that keeps itself right. Both
// exist because they answer different wants — "put it in my own calendar
// where I can move it" and "tell me when it changes" are not the same wish,
// and no single artefact does both.
//
// Same session, same UID as the single-item download and as the feed, so
// using more than one of these corrects rather than duplicates.

import { buildCalendarFeed, DEFAULT_EVENT_MINUTES, agendaEventUid } from '@thefibre/shared/ical';
import { ENTITY } from '@thefibre/shared';
import { richTextToPlain } from '@thefibre/shared/rich-text-plain';
import { serverSupabase } from '@/lib/supabase/server';
import { fetchPortal } from '@/lib/portal-api';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;

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

  const thread = portal.groups.flatMap((g) => g.threads).find((t) => t.thread_id === threadId);
  // Same answer for "does not exist" and "not yours": the search space is
  // already this person's, so a 404 leaks nothing either way.
  if (!thread) return new Response('Not found', { status: 404 });

  const dated = thread.agenda.filter((a) => a.starts_at);
  if (!dated.length) return new Response('Nothing to add yet', { status: 404 });

  const attendeeName =
    [portal.person.first_name, portal.person.last_name].filter(Boolean).join(' ') || null;

  const ics = buildCalendarFeed({
    name: thread.title,
    prodId: `-//${ENTITY.publicName}//Portal//EN`,
    events: dated.map((item) => {
      const startsAt = new Date(item.starts_at!);
      const endsAt = item.ends_at
        ? new Date(item.ends_at)
        : new Date(startsAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);
      return {
        uid: agendaEventUid(item.id),
        startsAt,
        endsAt,
        summary: item.title,
        // Flattened: a description is rich text and iCalendar has no markup,
        // so the tags would be read as part of the sentence — as they were,
        // in a real invitation, on 2026-09-25.
        description: [richTextToPlain(item.description), thread.title].filter(Boolean).join('\n\n'),
        location: item.location,
        url: item.meeting_url ?? item.external_url ?? thread.url,
        organizerName: thread.organiser_name,
        organizerEmail: thread.organiser_email,
        attendeeName,
        attendeeEmail: portal.person.email,
      };
    }),
  });

  const filename = `${thread.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'sessions'}.ics`;

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
