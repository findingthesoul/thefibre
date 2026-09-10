// The workspace-wide door.
//
// Sjoerd, 2026-09-10: "add the QR scanner at the bottom, and it scans
// throughout any list of this organiser/workspace… below the scanner is a
// button that says go to manual check-in, and then there is a list of only
// the threads that happen today."
//
// The scan is global because it safely can be: `checkin_code` is unique
// across every enrolment, and the API resolves it and then authorises with
// the same rule as approve/decline, so a ticket for a thread you do not run
// is a 403 rather than a leak. The MANUAL path is the one where a human
// picks an event by hand and could pick the wrong one, so it is scoped to
// today — which is Sjoerd's design and the reason a global scanner is safe
// to offer at all.

import { apiFetch, ApiError } from '@/lib/api';
import { one, type ThreadRow } from '@/lib/thread-types';
import { PageContainer, PageHeader, ErrorBanner, EmptyState } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { WorkspaceScanner } from './scanner';

export const dynamic = 'force-dynamic';

/** Today in the browser's own terms is not available server-side, and a
 *  thread's own timezone is the honest frame for "is this happening today".
 *  Threads carry `timezone`; the comparison is date-only, so an event that
 *  starts at 09:00 in Amsterdam is "today" all day. */
function happeningToday(thread: ThreadRow): boolean {
  const program = one(thread.program);
  if (!program) return false;
  if (program.status !== 'active') return false;
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: thread.timezone || 'Europe/Amsterdam',
  });
  const starts = program.starts_on;
  const ends = program.ends_on ?? program.starts_on;
  if (!starts) return false;
  return starts <= today && today <= (ends ?? starts);
}

export default async function WorkspaceCheckinPage() {
  const locale = await uiLocale();
  let threads: ThreadRow[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads');
    threads = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }
  const today = threads.filter(happeningToday);

  return (
    <PageContainer max="3xl">
      <PageHeader title={t(locale, 'nav_checkin')} description={t(locale, 'checkin_any_desc')} />
      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}
      <WorkspaceScanner
        locale={locale}
        today={today.map((th) => ({
          id: th.id,
          title: one(th.program)?.title ?? th.slug,
        }))}
      />
      {!error && today.length === 0 && (
        <EmptyState>{t(locale, 'nothing_today')}</EmptyState>
      )}
    </PageContainer>
  );
}
