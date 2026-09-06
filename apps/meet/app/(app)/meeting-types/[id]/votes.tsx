'use client';

import { useTransition } from 'react';
import { Check, CalendarCheck } from 'lucide-react';
import { confirmPollSlot } from '../actions';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';

type Slot = { starts_at: string; ends_at: string };
type Vote = {
  voter_email: string;
  voter_name: string;
  slot_starts_at: string;
  created_at: string;
};

export function PollVotesMatrix({
  mtId,
  slots,
  votes,
  locale,
}: {
  mtId: string;
  slots: Slot[];
  votes: Vote[];
  locale: Locale;
}) {
  const [pending, start] = useTransition();

  // Unique voters keyed by email; keep the most recent display name.
  const voterMap = new Map<string, { email: string; name: string }>();
  for (const v of votes) {
    voterMap.set(v.voter_email, { email: v.voter_email, name: v.voter_name });
  }
  const voters = Array.from(voterMap.values()).sort((a, b) =>
    a.email.localeCompare(b.email),
  );

  // Quick lookup: (email, slotISO) → true if voted.
  const voted = new Set<string>();
  for (const v of votes) {
    voted.add(`${v.voter_email}|${new Date(v.slot_starts_at).toISOString()}`);
  }

  function tally(slotIso: string): number {
    let n = 0;
    for (const voter of voters) {
      if (voted.has(`${voter.email}|${slotIso}`)) n++;
    }
    return n;
  }

  function confirm(slotIso: string) {
    if (!window.confirm(t(locale, 'confirm_poll_prompt'))) {
      return;
    }
    start(async () => {
      const r = await confirmPollSlot(mtId, slotIso);
      if (r.error) window.alert(t(locale, 'couldnt_confirm', { error: r.error }));
      else window.location.reload();
    });
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
        {t(locale, 'add_slots_first')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
      <table className="w-full text-sm">
        <thead className="bg-surface-sunken text-left">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-subtle">{t(locale, 'voter')}</th>
            {slots.map((s) => {
              const iso = new Date(s.starts_at).toISOString();
              const count = tally(iso);
              return (
                <th key={iso} className="px-4 py-3 font-medium align-bottom">
                  <div className="text-ink-subtle text-xs">
                    {new Intl.DateTimeFormat(INTL_LOCALES[locale], {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    }).format(new Date(s.starts_at))}
                  </div>
                  <div className="text-ink text-sm">
                    {new Intl.DateTimeFormat(INTL_LOCALES[locale], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(s.starts_at))}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    {count === 1 ? t(locale, 'one_vote') : t(locale, 'n_votes', { n: count })}
                  </div>
                  <button
                    type="button"
                    onClick={() => confirm(iso)}
                    disabled={pending}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-ink text-surface-raised px-2 py-1 text-[11px] font-medium hover:bg-ink/90 disabled:opacity-40"
                  >
                    <CalendarCheck className="h-3 w-3" strokeWidth={1.5} />
                    {t(locale, 'confirm')}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {voters.length === 0 ? (
            <tr>
              <td
                colSpan={slots.length + 1}
                className="px-4 py-6 text-center text-ink-subtle"
              >
                {t(locale, 'no_votes_yet')}
              </td>
            </tr>
          ) : (
            voters.map((voter) => (
              <tr key={voter.email}>
                <td className="px-4 py-3">
                  <div className="font-medium">{voter.name}</div>
                  <div className="text-xs text-ink-subtle">{voter.email}</div>
                </td>
                {slots.map((s) => {
                  const iso = new Date(s.starts_at).toISOString();
                  const did = voted.has(`${voter.email}|${iso}`);
                  return (
                    <td
                      key={iso}
                      className="px-4 py-3 text-center text-ink-subtle"
                    >
                      {did ? (
                        <Check
                          className="inline h-4 w-4 text-emerald-600"
                          strokeWidth={2}
                        />
                      ) : (
                        <span className="text-ink-muted">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
