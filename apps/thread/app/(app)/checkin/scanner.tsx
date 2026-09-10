'use client';

// Scanner first, manual second — the order somebody at a door actually needs
// them. The manual list only ever holds today's threads (see page.tsx).

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ScanLine } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { TicketScanner } from '@/components/ticket-scanner';
import { scanAnyTicket } from '../threads/actions';

export function WorkspaceScanner({
  locale,
  today,
}: {
  locale: Locale;
  today: { id: string; title: string }[];
}) {
  const [manual, setManual] = useState(false);

  return (
    <div className="mt-6">
      <TicketScanner locale={locale} onScan={scanAnyTicket}>
        {/* Under the camera, where Sjoerd asked for it: the way out when a
            phone screen is too dim, a ticket is on paper, or somebody arrives
            without one at all. */}
        <button
          type="button"
          onClick={() => setManual(true)}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium text-ink hover:bg-surface-sunken"
        >
          <ScanLine size={15} strokeWidth={1.75} />
          {t(locale, 'go_to_manual_checkin')}
        </button>
      </TicketScanner>

      {manual && (
        <section className="mt-6">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">
            {t(locale, 'happening_today')}
          </h2>
          {today.length === 0 ? (
            <p className="mt-3 text-sm text-ink-subtle">{t(locale, 'nothing_today')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
              {today.map((th) => (
                <li key={th.id}>
                  <Link
                    href={`/threads/${th.id}/checkin`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-sunken"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{th.title}</span>
                    <ChevronRight size={16} strokeWidth={1.75} className="text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
