'use client';

// The workspace door: scan first, then two tabs under it.
//
// Sjoerd, after using it at a real door (2026-09-11): "only see the people
// you just checked in, and have a second tab in the same screen with
// participant list."
//
// Those are two different questions and that is why they are two tabs.
// JUST IN answers "did that scan work, and who have I let through?" — it is
// the running receipt of this session, empty when you arrive and never
// searched, because you are reading the last few lines. EVERYONE answers
// "this person has no QR, are they on the list?" — searchable, the whole of
// today, checked-in state visible.

import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { TicketScanner } from '@/components/ticket-scanner';
import { DoorList, type DoorRow } from '../threads/[id]/checkin/door-list';
import { scanAnyTicket } from '../threads/actions';

type Admitted = { name: string; threadTitle?: string | undefined; at: string };

export function WorkspaceScanner({
  locale,
  rows,
  timezone,
}: {
  locale: Locale;
  rows: DoorRow[];
  timezone: string;
}) {
  // LAND ON THE LIST, not on the receipt (Sjoerd, 2026-09-11: "for desktop
  // the list is probably more intuitive than the QR"). It is the right
  // default on both: on a laptop nobody is holding up a phone camera, and on
  // a phone "Just in" is empty until you have scanned somebody, so landing
  // there means landing on nothing. The first successful scan switches over
  // by itself, because that is the moment the receipt starts being the
  // useful half.
  const [tab, setTab] = useState<'just' | 'everyone'>('everyone');
  const [justIn, setJustIn] = useState<Admitted[]>([]);

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(iso));

  return (
    <div className="mt-6">
      <TicketScanner
        locale={locale}
        onScan={async (code) => {
          const v = await scanAnyTicket(code);
          // Newest first: at a door you look at the top of the list.
          if (v.kind === 'admitted') {
            setJustIn((prev) => [
              { name: v.name, threadTitle: v.threadTitle, at: new Date().toISOString() },
              ...prev,
            ]);
            setTab('just');
          }
          return v;
        }}
      />

      <nav className="mt-5 border-b border-line">
        <ul className="-mb-px flex gap-1">
          {(
            [
              ['just', t(locale, 'tab_just_checked_in')],
              ['everyone', t(locale, 'tab_everyone_today')],
            ] as const
          ).map(([value, label]) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => setTab(value)}
                className={`inline-block border-b-2 px-3 py-2 text-sm transition-colors ${
                  tab === value
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-subtle hover:border-line-strong hover:text-ink'
                }`}
              >
                {label}
                {value === 'just' && justIn.length > 0 && (
                  <span className="ml-1.5 tabular-nums text-ink-muted">{justIn.length}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'just' ? (
        justIn.length === 0 ? (
          <p className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-ink-subtle">
            <ScanLine size={22} strokeWidth={1.5} className="text-ink-muted" />
            {t(locale, 'nobody_scanned_yet')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {justIn.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex items-baseline gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{a.name}</span>
                  {a.threadTitle && (
                    <span className="block truncate text-xs text-ink-muted">{a.threadTitle}</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-sm text-green-700">
                  {fmtTime(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        // The same door list the single-event screen uses, with today's
        // events mixed and each row carrying its own.
        <DoorList
          locale={locale}
          initialRows={rows}
          timezone={timezone}
          scanScope={null}
          showScanner={false}
        />
      )}
    </div>
  );
}
