'use client';

import { useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { List, LayoutGrid, CalendarDays, MapPin } from 'lucide-react';
import { ClickableBookingRow } from '@/components/clickable-booking-row';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';

export type BookingRow = {
  id: string;
  invitee_email: string;
  invitee_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  meet_url: string | null;
  alternative_location: string | null;
  meeting_type:
    | {
        id: string;
        name: string;
        slug: string;
        team_id: string | null;
        team:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        team_id: string | null;
        team:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }[]
    | null;
};

export type ScopeOption = { value: string; label: string };

type Props = {
  items: BookingRow[];
  scope: 'upcoming' | 'past' | 'all';
  view: 'list' | 'week' | 'month';
  includeCancelled: boolean;
  teamFilter: string;
  scopeOptions: ScopeOption[];
  locale: Locale;
};

const SCOPE_KEY: Record<'upcoming' | 'past' | 'all', UiKey> = {
  upcoming: 'scope_upcoming',
  past: 'scope_past',
  all: 'scope_all',
};

export function BookingsClient({
  items,
  scope,
  view,
  includeCancelled,
  teamFilter,
  scopeOptions,
  locale,
}: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${path}?${qs}` : path);
    });
  }

  return (
    <div className="space-y-6">
      {/* Top bar: scope tabs (Upcoming/Past/All) + view toggle (List/Week/Month) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-line bg-surface-raised p-0.5">
          {(['upcoming', 'past', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setParam('scope', s === 'upcoming' ? null : s)}
              className={`px-3 py-1.5 text-sm rounded-[5px] ${
                scope === s
                  ? 'bg-ink text-surface-raised'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {t(locale, SCOPE_KEY[s])}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-line bg-surface-raised p-0.5">
          {(
            [
              { v: 'list', label: t(locale, 'view_list'), Icon: List },
              { v: 'week', label: t(locale, 'view_week'), Icon: LayoutGrid },
              { v: 'month', label: t(locale, 'view_month'), Icon: CalendarDays },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setParam('view', opt.v === 'list' ? null : opt.v)}
              aria-label={opt.label}
              title={opt.label}
              className={`p-2 rounded-[5px] inline-flex items-center ${
                view === opt.v
                  ? 'bg-ink text-surface-raised'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <opt.Icon className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>

      {/* Filter row: team scope + include cancelled */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <span className="text-ink-subtle">{t(locale, 'scope')}</span>
          <select
            value={teamFilter}
            onChange={(e) => setParam('team_id', e.target.value || null)}
            className="rounded-md border border-line bg-surface-raised px-2 py-1 text-sm"
          >
            {scopeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-ink-subtle">
          <input
            type="checkbox"
            checked={includeCancelled}
            onChange={(e) =>
              setParam('include_cancelled', e.target.checked ? '1' : null)
            }
          />
          <span>{t(locale, 'include_cancelled')}</span>
        </label>
        {pending && <span className="text-xs text-ink-muted">{t(locale, 'loading')}</span>}
      </div>

      {/* The list itself — view changes the grouping. */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-raised p-8 text-center text-sm text-ink-subtle">
          {t(locale, 'nothing_in_view')}
        </div>
      ) : view === 'month' ? (
        <MonthGrid items={items} locale={locale} />
      ) : view === 'week' ? (
        <WeekList items={items} locale={locale} />
      ) : (
        <SimpleList items={items} locale={locale} />
      )}
    </div>
  );
}

function getMt(b: BookingRow) {
  if (!b.meeting_type) return null;
  return Array.isArray(b.meeting_type) ? b.meeting_type[0] : b.meeting_type;
}
function getTeam(b: BookingRow) {
  const mt = getMt(b);
  if (!mt?.team) return null;
  return Array.isArray(mt.team) ? mt.team[0] : mt.team;
}

function fmtDate(d: Date, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}
function fmtTime(d: Date, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function BookingItem({ b, locale }: { b: BookingRow; locale: Locale }) {
  const mt = getMt(b);
  const team = getTeam(b);
  const starts = new Date(b.starts_at);
  const ends = new Date(b.ends_at);
  return (
    <ClickableBookingRow booking={b} as="li" className="px-5 py-4 text-sm" locale={locale}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">
            {b.invitee_name}
            {mt && (
              <span className="text-ink-subtle font-normal">
                {' · '}
                {mt.name}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            {fmtDate(starts, locale)} · {fmtTime(starts, locale)}–{fmtTime(ends, locale)}
            {team && (
              <>
                {' · '}
                {team.name}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
              b.status === 'cancelled'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : b.status === 'pending_approval'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-ink text-surface-raised'
            }`}
          >
            {b.status === 'cancelled'
              ? t(locale, 'status_cancelled')
              : b.status === 'pending_approval'
                ? t(locale, 'status_pending')
                : t(locale, 'status_confirmed')}
          </span>
          {b.alternative_location && (
            <span className="text-[10px] uppercase tracking-wider text-ink-muted border border-line rounded px-1.5 py-0.5 inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" strokeWidth={1.5} /> {t(locale, 'location')}
            </span>
          )}
        </div>
      </div>
    </ClickableBookingRow>
  );
}

function SimpleList({ items, locale }: { items: BookingRow[]; locale: Locale }) {
  return (
    <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
      {items.map((b) => (
        <BookingItem key={b.id} b={b} locale={locale} />
      ))}
    </ul>
  );
}

function WeekList({ items, locale }: { items: BookingRow[]; locale: Locale }) {
  // Group by week (Mon-Sun) then by day.
  const byWeek = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of items) {
      const d = new Date(b.starts_at);
      const dow = (d.getDay() + 6) % 7; // Mon = 0
      const monday = new Date(d);
      monday.setDate(d.getDate() - dow);
      monday.setHours(0, 0, 0, 0);
      const k = monday.toISOString().slice(0, 10);
      const a = map.get(k) ?? [];
      a.push(b);
      map.set(k, a);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);
  return (
    <div className="space-y-6">
      {byWeek.map(([weekKey, arr]) => {
        const monday = new Date(weekKey);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const range = `${new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short' }).format(monday)} – ${new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short' }).format(sunday)}`;
        return (
          <div key={weekKey}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
              {t(locale, 'week_of', { range })}
            </div>
            <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
              {arr.map((b) => (
                <BookingItem key={b.id} b={b} locale={locale} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({ items, locale }: { items: BookingRow[]; locale: Locale }) {
  // Group bookings by YYYY-MM, then within each month by day-of-month.
  // Render each month as a 6×7 calendar grid (Mon-first) with booking
  // chips in each day cell. Days outside the month are dimmed.
  const months = useMemo(() => {
    const monthMap = new Map<string, Map<number, BookingRow[]>>();
    for (const b of items) {
      const d = new Date(b.starts_at);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let dayMap = monthMap.get(mKey);
      if (!dayMap) {
        dayMap = new Map();
        monthMap.set(mKey, dayMap);
      }
      const arr = dayMap.get(d.getDate()) ?? [];
      arr.push(b);
      dayMap.set(d.getDate(), arr);
    }
    // Sort bookings within each day by start time.
    for (const dayMap of monthMap.values()) {
      for (const arr of dayMap.values()) {
        arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      }
    }
    return Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div className="space-y-8">
      {months.map(([key, dayMap]) => {
        const [y, m] = key.split('-').map(Number);
        const year = y!;
        const month = (m ?? 1) - 1;
        const monthLabel = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
          month: 'long',
          year: 'numeric',
        }).format(new Date(year, month, 1));
        // First day of month, then back up to the Monday of that week.
        const first = new Date(year, month, 1);
        const dow = (first.getDay() + 6) % 7; // Mon=0
        const gridStart = new Date(year, month, 1 - dow);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cellsNeeded = Math.ceil((dow + daysInMonth) / 7) * 7;
        const cells: Date[] = Array.from({ length: cellsNeeded }, (_, i) => {
          const d = new Date(gridStart);
          d.setDate(gridStart.getDate() + i);
          return d;
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return (
          <div key={key}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
              {monthLabel}
            </div>
            <div className="rounded-lg border border-line bg-surface-raised overflow-hidden">
              <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider text-ink-muted bg-surface-sunken">
                {(['day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat', 'day_sun'] as const).map((d) => (
                  <div key={d} className="px-2 py-1.5 text-center">{t(locale, d)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((d, i) => {
                  const inMonth = d.getMonth() === month;
                  const dayBookings = inMonth ? dayMap.get(d.getDate()) ?? [] : [];
                  const isToday = d.getTime() === today.getTime();
                  return (
                    <div
                      key={i}
                      className={`min-h-[88px] border-t border-line p-1.5 ${
                        i % 7 !== 0 ? 'border-l' : ''
                      } ${inMonth ? '' : 'bg-surface-sunken/50'}`}
                    >
                      <div
                        className={`text-xs ${
                          isToday
                            ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-surface-raised font-medium'
                            : inMonth
                              ? 'text-ink'
                              : 'text-ink-muted'
                        }`}
                      >
                        {d.getDate()}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {dayBookings.slice(0, 3).map((b) => (
                          <MonthChip key={b.id} b={b} locale={locale} />
                        ))}
                        {dayBookings.length > 3 && (
                          <div className="text-[10px] text-ink-muted px-1">
                            {t(locale, 'n_more', { n: dayBookings.length - 3 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthChip({ b, locale }: { b: BookingRow; locale: Locale }) {
  const starts = new Date(b.starts_at);
  const mt = getMt(b);
  const cancelled = b.status === 'cancelled';
  return (
    <ClickableBookingRow
      booking={b}
      as="div"
      locale={locale}
      className={`rounded px-1.5 py-0.5 text-[10px] leading-tight truncate ${
        cancelled
          ? 'bg-red-50 text-red-700 line-through'
          : 'bg-ink text-surface-raised'
      }`}
    >
      <span className="font-medium">{fmtTime(starts, locale)}</span>
      {mt && <span className="ml-1 opacity-90">{mt.name}</span>}
    </ClickableBookingRow>
  );
}
