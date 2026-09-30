'use client';

import { useTransition } from 'react';
import { Check, CalendarCheck } from 'lucide-react';
import { confirmPollSlot } from '../actions';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';

type Slot = { starts_at: string; ends_at: string };
type Vote = {
  voter_email: string;
  voter_name: string;
  /** NULL when the voter answered "none of these work for me" — a vote about
   *  the poll rather than about a slot. */
  slot_starts_at: string | null;
  created_at: string;
  comment?: string | null;
};

export function PollVotesMatrix({
  mtId,
  slots,
  votes,
  invites = [],
  locale,
}: {
  mtId: string;
  slots: Slot[];
  votes: Vote[];
  /** Everyone asked. Somebody invited who has not voted is the whole reason
   *  this list exists — silence only reads as silence against a list. */
  invites?: { email: string; name: string }[];
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
  // Invited and not heard from. Listed under the table rather than as empty
  // rows in it: they have not answered, so they have nothing to show in a
  // column, and an empty row reads as "said no to everything".
  const silent = invites.filter((i) => !voterMap.has(i.email));

  // Quick lookup: (email, slotISO) → true if voted.
  const voted = new Set<string>();
  for (const v of votes) {
    if (!v.slot_starts_at) continue; // a "none of these" row ticks nothing
    voted.add(`${v.voter_email}|${new Date(v.slot_starts_at).toISOString()}`);
  }

  // The people who said none of these times work, and anything anybody wrote.
  // Without this the host sees a column of empty rows and cannot tell a
  // "cannot make any of them" from somebody who never answered.
  const cannotMakeAny = new Set(
    votes.filter((v) => !v.slot_starts_at).map((v) => v.voter_email),
  );
  const comments = new Map<string, string>();
  for (const v of votes) {
    const c = v.comment?.trim();
    if (c) comments.set(v.voter_email, c);
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
    <div className="space-y-3">
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
                  {/* An empty row means one of two very different things:
                      somebody who ticked nothing, and somebody who told you
                      they cannot make any of it. Say which. */}
                  {cannotMakeAny.has(voter.email) && (
                    <div className="mt-1 text-xs text-amber-700">
                      {t(locale, 'voter_none_of_these')}
                    </div>
                  )}
                  {comments.get(voter.email) && (
                    <div className="mt-1 max-w-xs text-xs text-ink-subtle italic whitespace-pre-wrap">
                      “{comments.get(voter.email)}”
                    </div>
                  )}
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

    {silent.length > 0 && (
      <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-sm">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          {t(locale, 'no_answer_yet')}
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-ink-subtle">
          {silent.map((i) => (
            <li key={i.email}>
              {i.name} <span className="text-ink-muted">{i.email}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
    </div>
  );
}
