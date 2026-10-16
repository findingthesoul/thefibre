'use client';

// Removing your data, from your own page.
//
// The right exists whether or not there is a button for it; what a button
// changes is that somebody does not have to find an address to write to.
//
// WHAT THIS SCREEN IS FOR, and it is not the button. It is the three
// sentences above it. Sjoerd asked the question that shaped this — *"what
// happens if someone requests removal but they have a seat, are organising
// threads in the future?"* — and the answer is that a person is entitled to
// know all of that BEFORE they ask, not to discover it in a reply three weeks
// later. So the page says what goes, what is kept whatever anyone asks, and
// what is blocked because other people are standing on it.
//
// Nothing here deletes anything. It files a request, a person reads it, and
// the thirty-day clock is in the law rather than in our diary. Anything that
// LOOKED instant would be a lie: these tables are append-only by design and
// erasure across them is anonymisation with a design behind it.

import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { requestErasure, type ErasurePicture } from '@/lib/portal-api';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';
import { fmtLongDate } from '@/lib/format';

export function RemoveData({ picture }: { picture: ErasurePicture }) {
  const [state, setState] = useState(picture);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();
  const day = (iso: string) => fmtLongDate(iso, locale);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      setState(await requestErasure(reason.trim() || null));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(locale, 'did_not_send'));
    } finally {
      setBusy(false);
    }
  }

  const blocked = state.blocked.upcoming_threads > 0;

  if (state.pending) {
    return (
      <section className="mt-10 border-t border-line pt-6">
        <h2 className="text-sm font-medium text-ink">{t(locale, 'rd_title')}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t(locale, 'rd_pending', { asked: day(state.pending.requested_at), due: day(state.pending.due_at) })}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-sm font-medium text-ink">{t(locale, 'rd_title')}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {t(locale, 'rd_intro')}
      </p>

      <dl className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-sm">
        <Row
          label={t(locale, 'rd_removed')}
          value={removesLine(state.removes, locale)}
        />
        {state.kept.invoices > 0 && (
          <Row
            label={t(locale, 'rd_kept')}
            value={t(locale, state.kept.invoices === 1 ? 'count_invoice_one' : 'count_invoice_many', { n: state.kept.invoices })}
            note={t(locale, 'rd_kept_note')}
          />
        )}
        {blocked && (
          <Row
            label={t(locale, 'rd_blocked')}
            value={t(locale, state.blocked.upcoming_threads === 1 ? 'rd_organise_one' : 'rd_organise_many', {
              n: state.blocked.upcoming_threads,
            })}
            note={`${t(
              locale,
              state.blocked.participants_affected === 1
                ? state.blocked.upcoming_threads === 1
                  ? 'rd_enrolled_p1_t1'
                  : 'rd_enrolled_p1_tn'
                : state.blocked.upcoming_threads === 1
                  ? 'rd_enrolled_pn_t1'
                  : 'rd_enrolled_pn_tn',
              { n: state.blocked.participants_affected },
            )} ${t(locale, 'rd_blocked_rest', {
              in: state.blocked.workspaces.length
                ? t(locale, 'rd_in_workspaces', { list: state.blocked.workspaces.join(', ') })
                : '',
            })}`}
          />
        )}
      </dl>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-medium text-ink hover:bg-surface-sunken"
        >
          <ShieldOff className="h-4 w-4" aria-hidden />
          {t(locale, 'rd_ask')}
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-line bg-surface-sunken p-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {t(locale, 'rd_reason')}
            </span>
            <textarea
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-line-strong focus:outline-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(locale, 'rd_placeholder')}
            />
          </label>
          <p className="mt-2 text-xs text-ink-muted">
            {t(locale, 'rd_explain')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-lg bg-ink px-5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-40"
            >
              {busy ? t(locale, 'sending') : t(locale, 'rd_send')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="min-h-11 text-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-40"
            >
              {t(locale, 'not_now')}
            </button>
            {error && <span className="text-sm text-ink-muted">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-ink-muted">{label}</dt>
        <dd className="min-w-0 text-right text-ink">{value}</dd>
      </div>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

/** Counted in the things a person recognises — places they took, calls they
 *  had, communities they joined — rather than in table names. */
function removesLine(r: ErasurePicture['removes'], locale: Locale): string {
  const parts = [
    r.enrolments ? t(locale, r.enrolments === 1 ? 'count_enrolment_one' : 'count_enrolment_many', { n: r.enrolments }) : null,
    r.bookings ? t(locale, r.bookings === 1 ? 'count_booking_one' : 'count_booking_many', { n: r.bookings }) : null,
    r.memberships ? t(locale, r.memberships === 1 ? 'count_membership_one' : 'count_membership_many', { n: r.memberships }) : null,
  ].filter(Boolean) as string[];
  if (!parts.length) return t(locale, 'rd_your_details');
  return t(locale, 'rd_and_details', { list: parts.join(', ') });
}
