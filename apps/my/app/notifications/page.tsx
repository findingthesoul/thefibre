// NOTIFICATIONS — what this person was told: a thread newly on a calendar
// their membership includes, and a session added, moved or cancelled on a
// thread they hold a place in or follow (the API's lib/member-notify.ts).
// Type, subject and date — never a body. Not only for members: somebody who
// bought one thread has a place, and hears about its sessions here too.
//
// Opening the page marks everything read, which is what clears the dot on
// the bell: a list you have looked at is a list you have read.

import Link from 'next/link';
import { loadFrame } from '@/lib/session';
import { fetchNotifications, markNotificationsRead, type MemberNotification } from '@/lib/portal-api';
import { DEFAULT_TZ, fmtDate, fmtDateTime } from '@/lib/format';
import { ROW_LIST } from '@thefibre/shared/ui/recipes';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { pageLocale } from '@/lib/locale';
import { t, type MyKey } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const WHAT: Record<MemberNotification['kind'], MyKey> = {
  new_thread: 'notif_new_thread',
  session_added: 'notif_session_added',
  session_moved: 'notif_session_moved',
  session_cancelled: 'notif_session_cancelled',
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  const { cursor = null } = await searchParams;
  const locale = await pageLocale();

  let page: { items: MemberNotification[]; next_cursor: string | null } | null = null;
  try {
    page = await fetchNotifications(session.token, cursor);
  } catch (e) {
    console.error('[my] /me/portal/notifications failed', e);
  }
  // After reading, so the rows still say which were new on this visit.
  if (page && page.items.some((n) => !n.read)) await markNotificationsRead(session.token);

  return (
    <PageShell title={t(locale, 'notifications')} subtitle={t(locale, 'notif_subtitle')}>
      {!page ? (
        <Empty title={t(locale, 'list_failed')}>{t(locale, 'try_again_moment')}</Empty>
      ) : page.items.length === 0 ? (
        <Empty title={cursor ? t(locale, 'upcoming_end_title') : t(locale, 'notif_none_title')}>
          {t(locale, 'notif_none_body')}
        </Empty>
      ) : (
        <>
          <ul className={`mt-8 ${ROW_LIST}`}>
            {page.items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                {/* The unread mark, for this visit: what made the dot. */}
                <span
                  aria-hidden
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-ink'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-ink-muted">
                    {t(locale, WHAT[n.kind])}
                    {n.community ? ` · ${n.community}` : ''}
                  </p>
                  <p className="mt-0.5 text-base text-ink">{n.subject}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {n.starts_at
                      ? n.kind === 'new_thread'
                        ? fmtDate(n.starts_at, locale, n.timezone || DEFAULT_TZ)
                        : fmtDateTime(n.starts_at, locale, n.timezone || DEFAULT_TZ)
                      : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-6">
            <Link
              href="/upcoming"
              className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
            >
              {t(locale, 'everything_coming')}
            </Link>
            {page.next_cursor && (
              <Link
                href={`/notifications?cursor=${encodeURIComponent(page.next_cursor)}`}
                className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
              >
                {t(locale, 'older')}
              </Link>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
