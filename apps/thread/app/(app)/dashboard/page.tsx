// The Thread's home page — the day, not the brochure.
//
// Sjoerd, 2026-09-11: "every time I have to skip it because there is nothing
// meaningful (yet??)". He was right, and it had been right for months: the
// page greeted you by name and then explained what the product is for, to
// someone already inside it, standing on top of their own live data.
//
// What replaced it answers the four questions a facilitator actually opens
// the app with, in the order the day asks them:
//
//   what needs me       → approvals waiting, invoices unpaid, threads undated
//   what is on now      → today's threads, with how full the room is
//   what is next        → the soonest few, and how far away
//   what just happened  → the last handful of people who signed up
//
// Every section hides itself when it is empty, so a quiet Tuesday is a short
// page rather than four empty boxes. The orientation copy did not die — it is
// what an EMPTY workspace sees, next to the template picker, which is the one
// moment somebody genuinely does not know what lives here.
//
// Two calls carry almost all of it: the thread list and the workspace's
// recent enrolments. Today's rooms get their own per-thread call, because
// "4 of 12 checked in" has to be exactly true when somebody is standing at a
// door — the 200-row workspace list is a prompt, not a ledger, and the counts
// derived from it are deliberately kept to things that link straight through
// to the page holding the full truth.

import Link from 'next/link';
import { ArrowRight, CalendarRange, Route, ScanLine } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { one, type ThreadRow } from '@/lib/thread-types';
import { happeningToday, startsLater, daysUntil } from '@/lib/thread-dates';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { TemplateCard, type TemplateLibrary } from '@/components/template-cards';

export const dynamic = 'force-dynamic';

type Me = {
  user: { full_name: string | null; email: string };
  workspace: { id: string; name: string; plan: string } | null;
};

/** Only the fields the dashboard reads — the endpoint returns far more. */
type EnrolmentBrief = {
  id: string;
  thread_id: string;
  payment_status: string | null;
  checked_in_at: string | null;
  created_at: string;
  person:
    | { first_name: string | null; last_name: string | null; email: string | null }
    | { first_name: string | null; last_name: string | null; email: string | null }[]
    | null;
  enrolment: { status: string | null } | { status: string | null }[] | null;
  thread:
    | { id: string; slug: string; program: { title: string } | { title: string }[] | null }
    | { id: string; slug: string; program: { title: string } | { title: string }[] | null }[]
    | null;
};

const personName = (e: EnrolmentBrief, locale: Locale) => {
  const p = one(e.person);
  return (
    [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.email || t(locale, 'unknown')
  );
};

/** "2 hours ago", "yesterday" — the unit a human would have used. */
function ago(locale: Locale, iso: string): string {
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: 'auto' });
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) < size * 60 || unit === 'month') {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return rtf.format(Math.round(seconds / 2629800), 'month');
}

export default async function ThreadDashboard() {
  const locale = await uiLocale();
  let error: string | null = null;

  const me = await apiFetch<Me>('/api/v1/auth/me').catch((e) => {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
    return null;
  });
  const threads =
    (await apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads').catch(() => null))?.items ??
    [];
  const enrolments =
    (await apiFetch<{ items: EnrolmentBrief[] }>('/api/v1/thread/enrolments').catch(() => null))
      ?.items ?? [];

  // ── what needs me ──────────────────────────────────────────────────────
  // 'invited' means two different waits: an application nobody has approved
  // yet, and an invoiced place nobody has paid. `payment_status` is what
  // tells them apart — the same test the registrations dialog uses to decide
  // whether to offer Approve.
  const status = (e: EnrolmentBrief) => one(e.enrolment)?.status ?? null;
  const awaitingApproval = enrolments.filter(
    (e) => status(e) === 'invited' && e.payment_status !== 'pending',
  ).length;
  const unpaid = enrolments.filter((e) => e.payment_status === 'pending').length;
  const undated = threads.filter((th) => {
    const p = one(th.program);
    return p && p.status !== 'archived' && p.status !== 'completed' && !p.starts_on;
  }).length;

  // ── what is on now ─────────────────────────────────────────────────────
  const today = threads.filter(happeningToday);
  const todayRooms = await Promise.all(
    today.map(async (th) => {
      const rows =
        (
          await apiFetch<{ items: EnrolmentBrief[] }>(
            `/api/v1/thread/enrolments?thread_id=${th.id}`,
          ).catch(() => null)
        )?.items ?? [];
      const expected = rows.filter((r) => one(r.enrolment)?.status !== 'dropped');
      return {
        thread: th,
        total: expected.length,
        done: expected.filter((r) => r.checked_in_at).length,
      };
    }),
  );

  // ── what is next ───────────────────────────────────────────────────────
  const upcoming = threads
    .filter(startsLater)
    .sort((a, b) => (one(a.program)?.starts_on ?? '').localeCompare(one(b.program)?.starts_on ?? ''))
    .slice(0, 4);
  const enrolledIn = (threadId: string) =>
    enrolments.filter((e) => e.thread_id === threadId && status(e) !== 'dropped').length;

  // ── what just happened ─────────────────────────────────────────────────
  const latest = enrolments.slice(0, 5);

  // First-event onboarding is DERIVED state, not a wizard: zero threads in
  // the workspace → the dashboard leads with the standard event shapes, and
  // keeps the orientation copy that a full workspace no longer needs.
  const empty = threads.length === 0;
  const library: TemplateLibrary | null = empty
    ? await apiFetch<TemplateLibrary>('/api/v1/thread/template-library').catch(() => null)
    : null;
  const firstEvent = library && library.templates.length > 0 ? library : null;

  const firstName =
    me?.user.full_name?.split(/\s+/)[0] ?? me?.user.email?.split('@')[0] ?? '';
  const todayLabel = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const dateOf = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso));

  const needs: { key: string; label: string; href: string }[] = [];
  if (awaitingApproval > 0)
    needs.push({
      key: 'approval',
      label: t(locale, 'dash_awaiting_approval', { count: awaitingApproval }),
      href: '/enrolments',
    });
  if (unpaid > 0)
    needs.push({
      key: 'unpaid',
      label: t(locale, 'dash_unpaid', { count: unpaid }),
      href: '/enrolments',
    });
  if (undated > 0)
    needs.push({
      key: 'undated',
      label: t(locale, 'dash_undated', { count: undated }),
      href: '/threads',
    });

  const quiet = !empty && needs.length === 0 && today.length === 0 && upcoming.length === 0;

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'dash_welcome', { name: firstName })} description={todayLabel} />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      {needs.length > 0 && (
        <section className="mt-8">
          <SectionLabel>{t(locale, 'dash_needs_you')}</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {needs.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 ring-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors dark:ring-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
              >
                {n.label}
                <ArrowRight size={12} strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {todayRooms.length > 0 && (
        <section className="mt-9">
          <SectionLabel>{t(locale, 'dash_today')}</SectionLabel>
          <ul className="mt-3 space-y-2">
            {todayRooms.map(({ thread, total, done }) => {
              const program = one(thread.program);
              return (
                <li
                  key={thread.id}
                  className="flex items-center gap-4 rounded-lg border border-line bg-surface-raised px-4 py-3.5"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 ring-1 ring-emerald-200 shrink-0 dark:bg-emerald-950/30 dark:ring-emerald-900/40">
                    <CalendarRange size={17} strokeWidth={1.75} className="text-emerald-700 dark:text-emerald-300" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/threads/${thread.id}`}
                      className="text-sm font-medium text-ink hover:underline truncate block"
                    >
                      {program?.title ?? thread.slug}
                    </Link>
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {t(locale, 'dash_checked_in_of', { done, total })}
                    </div>
                  </div>
                  <Link
                    href="/checkin"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium text-ink hover:bg-surface-sunken shrink-0"
                  >
                    <ScanLine size={15} strokeWidth={1.75} />
                    {t(locale, 'dash_open_door')}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-9">
          <div className="flex items-baseline justify-between gap-4">
            <SectionLabel>{t(locale, 'dash_coming_up')}</SectionLabel>
            <Link href="/threads" className="text-xs text-ink-subtle hover:text-ink">
              {t(locale, 'dash_see_all')}
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised">
            {upcoming.map((th) => {
              const program = one(th.program)!;
              const away = daysUntil(program.starts_on!, th.timezone);
              const Icon = program.format === 'journey' ? Route : CalendarRange;
              return (
                <li key={th.id}>
                  <Link
                    href={`/threads/${th.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-sunken/60 transition-colors"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
                      <Icon size={17} strokeWidth={1.75} className="text-ink-subtle" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink truncate">{program.title}</div>
                      <div className="text-xs text-ink-subtle mt-0.5">
                        {dateOf(program.starts_on!)} ·{' '}
                        {away === 1
                          ? t(locale, 'dash_tomorrow')
                          : t(locale, 'dash_in_days', { days: away })}
                      </div>
                    </div>
                    <span className="text-xs text-ink-subtle shrink-0">
                      {t(locale, 'dash_enrolled_count', { count: enrolledIn(th.id) })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {latest.length > 0 && (
        <section className="mt-9">
          <div className="flex items-baseline justify-between gap-4">
            <SectionLabel>{t(locale, 'dash_recent')}</SectionLabel>
            <Link href="/enrolments" className="text-xs text-ink-subtle hover:text-ink">
              {t(locale, 'dash_see_all')}
            </Link>
          </div>
          <ul className="mt-3 space-y-1.5">
            {latest.map((e) => {
              const th = one(e.thread);
              return (
                <li key={e.id} className="flex items-baseline gap-3 text-sm">
                  <span className="text-ink truncate">{personName(e, locale)}</span>
                  <span className="text-ink-muted text-xs truncate min-w-0 flex-1">
                    {one(th?.program ?? null)?.title ?? ''}
                  </span>
                  <span className="text-ink-muted text-xs shrink-0">{ago(locale, e.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {quiet && (
        <section className="mt-9">
          <EmptyState>{t(locale, 'dash_quiet')}</EmptyState>
        </section>
      )}

      {firstEvent && (
        <section className="mt-10">
          <h2 className="text-lg font-medium tracking-tight">{t(locale, 'dash_first_title')}</h2>
          <p className="mt-1.5 text-sm text-ink-subtle leading-relaxed max-w-xl">
            {t(locale, 'dash_first_desc')}
          </p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {firstEvent.templates.map((tp) => (
              <TemplateCard
                key={tp.id}
                locale={locale}
                template={tp}
                href={`/threads/new?template=${tp.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Orientation, for the one moment it orients: an empty workspace. */}
      {empty && (
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <SectionLabel>{t(locale, 'dash_what_lives_here')}</SectionLabel>
            <ul className="mt-3 space-y-3 text-sm text-ink-subtle leading-relaxed">
              <li>· {t(locale, 'dash_lives_1')}</li>
              <li>· {t(locale, 'dash_lives_2')}</li>
              <li>· {t(locale, 'dash_lives_3')}</li>
              <li>· {t(locale, 'dash_lives_4')}</li>
            </ul>
          </div>
          <div>
            <SectionLabel>{t(locale, 'dash_what_stays')}</SectionLabel>
            <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
              {t(locale, 'dash_stays_body')}
            </p>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
