'use client';

import {
  HORIZONS,
  type Horizon,
  type PersonRef,
  type OwedRow,
  type PrepareSignal,
  type PrepareRow,
  type TodayPayload,
} from './shape';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarClock, CheckSquare, Receipt, UserRound } from 'lucide-react';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { formatMinutes } from '@/lib/effort-format';

// The rendering half of Today. Client, for one reason that matters: the only
// clock in a server render is Fly's, which is UTC, so a 14:00 meeting would
// show as 12:00 to a Dutch facilitator in summer. Times are formatted in the
// VIEWER's timezone here. The SSR pass still runs on the server, so those
// spans carry suppressHydrationWarning — the client value is the correct one
// and React keeps it.
//
// Everything else follows docs/connections-mobile.md §4: counts before lists,
// nothing on hover, every row taps into exactly one thing.

// Explicit maps, never a computed key. The catalog is typed so a missing
// translation is a compile error, and `t(locale, \`today_seg_${h}\`)` throws
// exactly that guarantee away.
const SEGMENT_KEYS = {
  today: 'today_seg_today',
  tomorrow: 'today_seg_tomorrow',
  week: 'today_seg_week',
  next_week: 'today_seg_next_week',
} as const;

const SIGNAL_ICONS = {
  thread_unreached: UserRound,
  thread_unpaid: Receipt,
  meeting_brief: CalendarClock,
  money_uninvoiced: Receipt,
} as const;

const DAY = 86_400_000;

function personName(p: PersonRef | null, fallback: string) {
  if (!p) return fallback;
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || fallback;
}

/** "today" / "tomorrow" / "in 9 days" / "3 days ago". Day counts come from
 *  the server so the phrasing cannot disagree with the segment the row is in. */
function relative(days: number, locale: Locale) {
  if (days < 0) return t(locale, 'today_when_days_ago', { n: -days });
  if (days === 0) return t(locale, 'today_when_now');
  if (days === 1) return t(locale, 'today_when_tomorrow');
  return t(locale, 'today_when_in_days', { n: days });
}

/** The fact that produced the row, phrased. Never a score — the same rule the
 *  attention conditions follow (docs/connections-model.md §3.2, D25). */
function prepareDetail(r: PrepareRow, locale: Locale): string {
  switch (r.signal) {
    case 'thread_unreached':
      return t(locale, 'today_sig_unreached', { count: r.count ?? 0, of: r.of ?? 0 });
    case 'thread_unpaid':
      return t(locale, 'today_sig_unpaid', { count: r.count ?? 0, of: r.of ?? 0 });
    case 'money_uninvoiced': {
      const amount =
        r.amount_cents === null
          ? ''
          : new Intl.NumberFormat(INTL_LOCALES[locale], {
              style: 'currency',
              currency: r.currency || 'EUR',
              maximumFractionDigits: 0,
            }).format(r.amount_cents / 100);
      return t(locale, 'today_sig_money', { amount });
    }
    case 'meeting_brief': {
      const d = r.days_since_spoken;
      if (d === null) return t(locale, 'today_spoke_never');
      // Past two months a day count stops being legible. "Eight months" is
      // the sentence in the spec, and it is the one a person actually hears.
      if (d >= 60) return t(locale, 'today_spoke_months', { n: Math.round(d / 30) });
      return t(locale, 'today_spoke_days', { n: d });
    }
  }
}

function Segments({
  segments,
  active,
  locale,
}: {
  segments: { key: Horizon; count: number; minutes: number }[];
  active: Horizon;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const byKey = new Map(segments.map((s) => [s.key, s]));

  // A segmented control, not four stacked sections — four sections means
  // scrolling past three you did not ask for (§3). The COUNT is on every
  // segment, because that is the part you read before you tap: next week
  // being heavy is visible without opening it.
  return (
    <div
      className={`mt-6 flex w-full overflow-hidden rounded-lg border border-line bg-surface-sunken p-0.5 ${
        pending ? 'opacity-60' : ''
      }`}
      role="tablist"
    >
      {HORIZONS.map((h) => {
        const on = h === active;
        return (
          <Link
            key={h}
            href={`/today?horizon=${h}`}
            role="tab"
            aria-selected={on}
            onClick={(e) => {
              // Keeps the tap feeling instant on a phone: the control dims
              // rather than flashing a blank page under the thumb.
              e.preventDefault();
              startTransition(() => router.push(`/today?horizon=${h}`));
            }}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-2 text-center text-xs transition-colors ${
              on ? 'bg-surface-raised font-medium shadow-sm' : 'text-ink-muted'
            }`}
          >
            <span className="truncate">{t(locale, SEGMENT_KEYS[h])}</span>
            <span className="tabular-nums text-[11px] leading-none">{byKey.get(h)?.count ?? 0}</span>
            {/* The estimate under the count: "next week is heavy" in hours,
                not only in rows (connections-overview.md §3). */}
            {(byKey.get(h)?.minutes ?? 0) > 0 && (
              <span className="tabular-nums text-[10px] leading-none text-ink-subtle">
                {formatMinutes(byKey.get(h)!.minutes, locale)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function Today({
  data,
  horizon,
  locale,
  personBase,
  threadBase,
}: {
  data: TodayPayload;
  horizon: Horizon;
  locale: Locale;
  personBase: string;
  threadBase: string;
}) {
  const now = new Date(data.now).getTime();
  const empty = data.owed.length === 0 && data.prepare.length === 0;
  const totalMinutes = data.segments.find((s) => s.key === horizon)?.minutes ?? 0;

  const time = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { timeStyle: 'short' }).format(new Date(iso));

  return (
    <div>
      <Segments segments={data.segments} active={horizon} locale={locale} />

      {empty && <p className="mt-8 text-sm text-ink-muted">{t(locale, 'today_all_clear')}</p>}

      {/* One sentence that turns the list into a plan. Estimates are the
          defaults for each kind of work, adjustable in settings, and the
          sentence says "about" because that is what they are. */}
      {!empty && totalMinutes > 0 && (
        <p className="mt-4 text-sm text-ink-muted">
          {t(locale, 'today_effort_total', { time: formatMinutes(totalMinutes, locale) })}
        </p>
      )}

      {/* Preparation first. What you owe you already know about; what is
          coming at you is the thing you would otherwise meet unprepared. */}
      <section className="mt-8">
        <h2 className="flex items-baseline gap-2 text-sm font-medium">
          {t(locale, 'today_prepare_heading')}
          <span className="tabular-nums text-ink-muted">{data.prepare.length}</span>
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'today_prepare_sub')}</p>

        {data.prepare.length === 0 && !empty && (
          <p className="mt-3 text-sm text-ink-muted">{t(locale, 'today_prepare_none')}</p>
        )}

        <ul className="mt-3 space-y-1.5">
          {data.prepare.map((r) => {
            const Icon = SIGNAL_ICONS[r.signal];
            // Exactly ONE destination per row, never a menu (§4.4). A person
            // row goes to the person; a thread row goes to the thread.
            const href =
              r.link?.kind === 'person'
                ? `${personBase}/${r.link.id}`
                : r.link?.kind === 'thread'
                  ? `${threadBase}/${r.link.id}`
                  : null;
            const title =
              r.signal === 'meeting_brief'
                ? personName(r.person, r.subject)
                : r.subject;

            const body = (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Icon size={14} className="shrink-0 text-ink-muted" />
                    <span className="truncate">{title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                    {r.minutes > 0 && <span className="mr-2 text-ink-subtle">~{formatMinutes(r.minutes, locale)}</span>}
                    {relative(r.days_until, locale)}
                    {r.signal === 'meeting_brief' && (
                      <>
                        {' · '}
                        <span suppressHydrationWarning>{time(r.happens_at)}</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{prepareDetail(r, locale)}</p>
              </>
            );

            return (
              <li
                key={r.id}
                className="rounded-md border border-line bg-surface-raised px-3 py-2.5"
              >
                {href ? (
                  <Link href={href} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="flex items-baseline gap-2 text-sm font-medium">
          {t(locale, 'today_owed_heading')}
          <span className="tabular-nums text-ink-muted">{data.owed.length}</span>
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'today_owed_sub')}</p>

        {data.owed.length === 0 && !empty && (
          <p className="mt-3 text-sm text-ink-muted">{t(locale, 'today_owed_none')}</p>
        )}

        <ul className="mt-3 space-y-1.5">
          {data.owed.map((o) => {
            const days = Math.round((new Date(o.due_at).getTime() - now) / DAY);
            const subject = o.person
              ? personName(o.person, '')
              : (o.organisation?.name ?? '');
            const body = (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    {o.overdue ? (
                      <AlertCircle size={14} className="shrink-0 text-ink" />
                    ) : (
                      <CheckSquare size={14} className="shrink-0 text-ink-muted" />
                    )}
                    <span className="truncate">{o.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                    {o.minutes > 0 && <span className="mr-2 text-ink-subtle">~{formatMinutes(o.minutes, locale)}</span>}
                    {o.overdue && <span className="mr-1">{t(locale, 'today_overdue')}</span>}
                    {relative(days, locale)}
                  </span>
                </div>
                {subject && <p className="mt-1 text-xs text-ink-muted">{subject}</p>}
              </>
            );
            return (
              <li
                key={o.id}
                className="rounded-md border border-line bg-surface-raised px-3 py-2.5"
              >
                {o.person ? (
                  <Link href={`${personBase}/${o.person.id}`} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
