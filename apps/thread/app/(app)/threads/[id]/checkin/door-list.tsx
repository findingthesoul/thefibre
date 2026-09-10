'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { TicketScanner } from '@/components/ticket-scanner';
import { Camera, CameraOff, CheckCircle2, Search, Undo2 } from 'lucide-react';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { checkinEnrolment, scanTicket, type ScanVerdict } from '../../actions';

export type DoorRow = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  payment_status: string | null;
  checked_in_at: string | null;
};

// Every ticket carries its own address; the id inside it is the guest.
const THREAD_CODE = /(?:checkin\/)?([0-9a-f]{32})/i;
const FLASH_MS = 2200;
const REPEAT_MS = 4000;

export function DoorList({
  locale,
  threadId,
  initialRows,
  timezone,
}: {
  locale: Locale;
  threadId: string;
  initialRows: DoorRow[];
  timezone: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Mirrors the scanner's camera state, reported by TicketScanner.
  const [scanning, setScanning] = useState(false);
  const [, startTransition] = useTransition();

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(iso));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const checkedIn = rows.filter((r) => r.checked_in_at).length;

  function toggle(row: DoorRow) {
    // One door at a time: while the camera is live, the list is for looking
    // at. A thumb resting on a row must not admit somebody mid-scan.
    if (scanning) return;
    const undo = !!row.checked_in_at;
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      const r = await checkinEnrolment(threadId, row.id, undo);
      setBusyId(null);
      if (!r.ok) return setError(r.error);
      setRows((rs) =>
        rs.map((x) => (x.id === row.id ? { ...x, checked_in_at: r.checked_in_at } : x)),
      );
    });
  }



  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 text-sm text-ink-subtle">
        <span>
          <strong className="font-medium text-ink">{checkedIn}</strong> / {rows.length}{' '}
          {t(locale, 'checked_in_lower')}
        </span>
        <TicketScanner
          locale={locale}
          onScanningChange={setScanning}
          onScan={async (code) => {
            const v = await scanTicket(threadId, code);
            // The door's own list ticks the row it just admitted.
            if (v.kind === 'admitted') {
              setRows((rs) =>
                rs.map((x) =>
                  x.name === v.name && !x.checked_in_at
                    ? { ...x, checked_in_at: new Date().toISOString() }
                    : x,
                ),
              );
            }
            return v;
          }}
        />
      </div>

      <div className="relative mt-3">
        <Search
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, 'search_name_email')}
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-base outline-none focus:border-ink"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {scanning && (
        <p className="mt-3 text-xs text-ink-muted">{t(locale, 'camera_is_door')}</p>
      )}

      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink-subtle">
            {rows.length === 0 ? t(locale, 'nobody_registered') : t(locale, 'no_match')}
          </li>
        )}
        {visible.map((r) => {
          const done = !!r.checked_in_at;
          const note =
            r.status === 'invited'
              ? t(locale, 'not_approved_yet')
              : r.payment_status === 'pending'
                ? t(locale, 'payment_pending_lower')
                : null;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={busyId === r.id || scanning}
                aria-disabled={scanning}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunken disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] ${done ? 'text-ink-subtle' : ''}`}>
                    {r.name}
                  </span>
                  {note && <span className="block text-xs text-amber-700">{note}</span>}
                </span>
                {done ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-green-700">
                    <CheckCircle2 size={18} />
                    {fmtTime(r.checked_in_at!)}
                    {!scanning && <Undo2 size={13} className="ml-1 text-ink-muted" />}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium">
                    {t(locale, 'check_in')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
