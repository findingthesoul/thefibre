'use client';

import Link from 'next/link';
import { useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
};

export function BookingsClient({
  items,
  scope,
  view,
  includeCancelled,
  teamFilter,
  scopeOptions,
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
              className={`px-3 py-1.5 text-sm rounded-[5px] capitalize ${
                scope === s
                  ? 'bg-ink text-surface-raised'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-line bg-surface-raised p-0.5">
          {(
            [
              { v: 'list', label: 'List', icon: '☰' },
              { v: 'week', label: 'Week', icon: '▦' },
              { v: 'month', label: 'Month', icon: '🗓' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setParam('view', opt.v === 'list' ? null : opt.v)}
              className={`px-3 py-1.5 text-sm rounded-[5px] inline-flex items-center gap-1 ${
                view === opt.v
                  ? 'bg-ink text-surface-raised'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <span aria-hidden="true" className="text-xs">
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter row: team scope + include cancelled */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <span className="text-ink-subtle">Scope</span>
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
          <span>Include cancelled</span>
        </label>
        {pending && <span className="text-xs text-ink-muted">Loading…</span>}
      </div>

      {/* The list itself — view changes the grouping. */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-raised p-8 text-center text-sm text-ink-subtle">
          Nothing in this view.
        </div>
      ) : view === 'month' ? (
        <MonthGrid items={items} />
      ) : view === 'week' ? (
        <WeekList items={items} />
      ) : (
        <SimpleList items={items} />
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

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}
function fmtTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function BookingItem({ b }: { b: BookingRow }) {
  const mt = getMt(b);
  const team = getTeam(b);
  const starts = new Date(b.starts_at);
  const ends = new Date(b.ends_at);
  return (
    <li className="px-5 py-4 text-sm">
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
            {fmtDate(starts)} · {fmtTime(starts)}–{fmtTime(ends)}
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
                : 'bg-ink text-surface-raised'
            }`}
          >
            {b.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}
          </span>
          {b.alternative_location && (
            <span className="text-[10px] uppercase tracking-wider text-ink-muted border border-line rounded px-1.5 py-0.5 inline-flex items-center gap-1">
              📍 Location
            </span>
          )}
          {b.meet_url && (
            <Link
              href={b.meet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
            >
              Join
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function SimpleList({ items }: { items: BookingRow[] }) {
  return (
    <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
      {items.map((b) => (
        <BookingItem key={b.id} b={b} />
      ))}
    </ul>
  );
}

function WeekList({ items }: { items: BookingRow[] }) {
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
        const range = `${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(monday)} – ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(sunday)}`;
        return (
          <div key={weekKey}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
              Week of {range}
            </div>
            <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
              {arr.map((b) => (
                <BookingItem key={b.id} b={b} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({ items }: { items: BookingRow[] }) {
  // Group by month, then list days that have bookings.
  const byMonth = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of items) {
      const d = new Date(b.starts_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const a = map.get(k) ?? [];
      a.push(b);
      map.set(k, a);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);
  return (
    <div className="space-y-8">
      {byMonth.map(([key, arr]) => {
        const [y, m] = key.split('-').map(Number);
        const monthLabel = new Intl.DateTimeFormat(undefined, {
          month: 'long',
          year: 'numeric',
        }).format(new Date(y!, (m ?? 1) - 1, 1));
        return (
          <div key={key}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
              {monthLabel}
            </div>
            <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
              {arr.map((b) => (
                <BookingItem key={b.id} b={b} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
