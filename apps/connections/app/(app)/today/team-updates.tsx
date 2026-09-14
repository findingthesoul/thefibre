'use client';

// A team's updates over a period, for an update meeting.
//
// Sjoerd, 2026-09-14: *"in my to do, I can make a selection of the things that
// have shifted last week or last two weeks or whatever. I can give a period.
// And I see all my updates of that team. And it means that everybody part of
// the team is then listed. And this way, we can do an update meeting, for
// example, and then we can just immediately see all the shifts."*
//
// On Today, under what you owe, because an update meeting is part of the day.
// Collapsed to a single row until opened: most mornings are not a meeting, and
// a list of everybody's notes above the fold every day would bury the tasks.
//
// Everyone in the team is listed, including people who filed nothing — the API
// returns them on purpose, since somebody with nothing to report is still in
// the meeting.

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FieldSelect } from '@thefibre/shared/ui/fields';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { usePersonPopup } from '@/components/person-popup';
import {
  loadMyTeams,
  loadTeamUpdates,
  type MyTeam,
  type TeamUpdates,
} from '@/app/(app)/people/[id]/actions';

const PERIODS = [7, 14, 30] as const;

export function TeamUpdatesPanel({ locale }: { locale: Locale }) {
  const { openPerson } = usePersonPopup();
  const [teams, setTeams] = useState<MyTeam[] | null>(null);
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [days, setDays] = useState<number>(14);
  const [result, setResult] = useState<TeamUpdates | null>(null);

  useEffect(() => {
    let alive = true;
    void loadMyTeams().then((mine) => {
      if (!alive) return;
      setTeams(mine);
      setTeamId(mine.find((tm) => tm.is_default)?.id ?? mine[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open || !teamId) return;
    let alive = true;
    setResult(null);
    void safely(
      () => loadTeamUpdates(teamId, days),
      (error) => ({ ok: false as const, error }),
    ).then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, [open, teamId, days]);

  // Nothing at all for somebody in no team — no empty heading, no hint.
  if (!teams || teams.length === 0) return null;

  const when = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium' }).format(new Date(iso));
  const total = result?.ok ? result.members.reduce((n, m) => n + m.updates.length, 0) : null;

  return (
    <section className="mt-8 rounded-lg border border-line bg-surface-raised">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {t(locale, 'team_updates_title')}
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <FieldSelect
              inline
              value={teamId ?? ''}
              onChange={(e) => setTeamId(e.target.value || null)}
              aria-label={t(locale, 'team_for')}
              options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
            />
            <FieldSelect
              inline
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label={t(locale, 'move_period')}
              options={PERIODS.map((d) => ({ value: String(d), label: t(locale, 'move_days', { n: d }) }))}
            />
            {total !== null && (
              <span className="text-xs text-ink-muted">{t(locale, 'team_updates_count', { n: total })}</span>
            )}
          </div>

          {!result && <p className="mt-3 text-xs text-ink-muted">{t(locale, 'loading')}</p>}
          {result && !result.ok && <p className="mt-3 text-xs text-ink">{result.error}</p>}

          {result?.ok && (
            <ul className="mt-4 space-y-4">
              {result.members.map((m) => (
                <li key={m.user_id}>
                  <h3 className="text-sm font-medium">
                    {m.name || '…'}
                    <span className="ml-2 text-xs font-normal text-ink-muted tabular-nums">{m.updates.length}</span>
                  </h3>
                  {m.updates.length === 0 ? (
                    <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'team_updates_none')}</p>
                  ) : (
                    <ul className="mt-1.5 space-y-1.5 border-l border-line pl-3">
                      {m.updates.map((u) => (
                        <li key={u.id} className="text-sm">
                          <div className="text-xs text-ink-muted">
                            {when(u.happened_at)}
                            {u.person && (
                              <>
                                {' · '}
                                <button
                                  type="button"
                                  onClick={() => openPerson(u.person!.id)}
                                  className="hover:text-ink hover:underline"
                                >
                                  {u.person.name || '…'}
                                </button>
                              </>
                            )}
                          </div>
                          {u.body.trim() ? (
                            <p className="whitespace-pre-wrap break-words">{u.body}</p>
                          ) : (
                            <p className="text-ink-muted">{t(locale, 'note_no_words')}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
