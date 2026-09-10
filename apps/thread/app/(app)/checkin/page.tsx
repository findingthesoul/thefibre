// The workspace-wide door.
//
// Sjoerd, 2026-09-10: "add the QR scanner at the bottom, and it scans
// throughout any list of this organiser/workspace". Then, after using it at a
// real door: a tab for the people you just checked in, and a second tab with
// the participant list.
//
// The scan is global because it safely can be: `checkin_code` is unique
// across every enrolment, and the API resolves it and then authorises with
// the same rule as approve/decline, so a ticket for a thread you do not run
// is a 403 rather than a leak — which Sjoerd confirmed by trying it from the
// wrong account before it worked from the right one.
//
// The LIST is scoped to today. That is the path where a human picks a person
// by hand and could pick the wrong event, and it is also the only scoping
// that keeps the list readable: everyone the workspace has ever enrolled is
// not a door list.

import { apiFetch, ApiError } from '@/lib/api';
import { one, type ThreadRow } from '@/lib/thread-types';
import { PageContainer, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import type { DoorRow } from '../threads/[id]/checkin/door-list';
import { WorkspaceScanner } from './scanner';

export const dynamic = 'force-dynamic';

type EnrolmentListRow = {
  id: string;
  payment_status: string | null;
  checked_in_at: string | null;
  person:
    | { first_name: string | null; last_name: string | null; email: string | null }
    | { first_name: string | null; last_name: string | null; email: string | null }[]
    | null;
  enrolment: { status: string | null } | { status: string | null }[] | null;
};

/** A thread's own timezone is the honest frame for "is this happening
 *  today" — an event that starts at 09:00 in Amsterdam is today all day,
 *  wherever the phone is. Date-only comparison. */
function happeningToday(thread: ThreadRow): boolean {
  const program = one(thread.program);
  if (!program || program.status !== 'active') return false;
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: thread.timezone || 'Europe/Amsterdam',
  });
  const starts = program.starts_on;
  if (!starts) return false;
  const ends = program.ends_on ?? starts;
  return starts <= today && today <= ends;
}

export default async function WorkspaceCheckinPage() {
  const locale = await uiLocale();
  let threads: ThreadRow[] = [];
  let error: string | null = null;
  try {
    threads = (await apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads')).items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }
  const today = threads.filter(happeningToday);

  // One request per event happening today. That is a handful on any real
  // day, and each is already the query the single-event door runs.
  const perThread = await Promise.all(
    today.map(async (th) => {
      try {
        const { items } = await apiFetch<{ items: EnrolmentListRow[] }>(
          `/api/v1/thread/enrolments?thread_id=${th.id}`,
        );
        return { th, items };
      } catch {
        return { th, items: [] as EnrolmentListRow[] };
      }
    }),
  );

  const rows: DoorRow[] = perThread
    .flatMap(({ th, items }) =>
      items.map((r) => {
        const p = one(r.person);
        const e = one(r.enrolment);
        return {
          id: r.id,
          threadId: th.id,
          // Only worth showing when the door covers more than one event.
          threadTitle: today.length > 1 ? one(th.program)?.title ?? th.slug : undefined,
          name:
            [p?.first_name, p?.last_name].filter(Boolean).join(' ') ||
            p?.email ||
            t(locale, 'unknown'),
          email: p?.email ?? null,
          status: e?.status ?? null,
          payment_status: r.payment_status,
          checked_in_at: r.checked_in_at,
        } satisfies DoorRow;
      }),
    )
    // Declined applications don't belong on a door list.
    .filter((r) => r.status !== 'dropped')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageContainer max="3xl">
      <PageHeader title={t(locale, 'nav_checkin')} description={t(locale, 'checkin_any_desc')} />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}
      <WorkspaceScanner
        locale={locale}
        rows={rows}
        timezone={today[0]?.timezone ?? 'Europe/Amsterdam'}
      />
    </PageContainer>
  );
}
