'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Undo2, ArrowRight } from 'lucide-react';
import { mergePeople, undoMerge } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type DupPerson = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  created_at?: string | null;
  created_via?: string | null;
};

export type DupPair = {
  reason: string;
  score: number;
  a: DupPerson;
  b: DupPerson;
};

export type MergeRow = {
  id: string;
  kept_person_id: string;
  merged_person_id: string;
  merged_at: string;
  undone_at: string | null;
  dropped_rows: number;
};

function displayName(p: DupPerson) {
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return n || p.email || p.id.slice(0, 8);
}

// Explicit maps rather than `dup_reason_${reason}` template keys: the
// catalog is typed so a missing translation is a compile error, and a
// computed key throws that guarantee away exactly where it is most useful.
const REASON_KEYS = {
  same_email: 'dup_reason_same_email',
  same_name: 'dup_reason_same_name',
  similar_name: 'dup_reason_similar_name',
} as const;

const SOURCE_KEYS = {
  manual: 'dup_source_manual',
  meet_booking: 'dup_source_meet_booking',
  meet_invite: 'dup_source_meet_invite',
  thread_enrolment: 'dup_source_thread_enrolment',
  thread_participant: 'dup_source_thread_participant',
  member_invite: 'dup_source_member_invite',
  membership_join: 'dup_source_membership_join',
  membership_purchase: 'dup_source_membership_purchase',
  app_link: 'dup_source_app_link',
} as const;

function reasonLabel(locale: Locale, reason: string) {
  const key = REASON_KEYS[reason as keyof typeof REASON_KEYS];
  return key ? t(locale, key) : reason.replace(/_/g, ' ');
}

/** How a record arrived. Null for everything created before v0.70.0, which
 *  is honest — we genuinely do not know. A source added to PersonSource but
 *  not to SOURCE_KEYS falls back to its raw name rather than a blank. */
function sourceLabel(locale: Locale, via: string | null | undefined) {
  if (!via) return t(locale, 'dup_source_unknown');
  const key = SOURCE_KEYS[via as keyof typeof SOURCE_KEYS];
  return key ? t(locale, key) : via.replace(/_/g, ' ');
}

function PersonCard({
  person,
  locale,
  onKeep,
  busy,
  intlLocale,
}: {
  person: DupPerson;
  locale: Locale;
  onKeep: () => void;
  busy: boolean;
  intlLocale: string;
}) {
  return (
    <div className="flex-1 rounded-md border border-line bg-surface-raised p-3">
      <Link
        href={`/contacts/${person.id}`}
        className="text-sm font-medium hover:underline break-words"
      >
        {displayName(person)}
      </Link>
      <div className="mt-1 text-xs text-ink-muted break-all">{person.email ?? '—'}</div>
      <div className="mt-2 text-xs text-ink-muted">
        {person.created_at
          ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(
              new Date(person.created_at),
            )
          : '—'}
        {' · '}
        {sourceLabel(locale, person.created_via)}
      </div>
      <button
        type="button"
        onClick={onKeep}
        disabled={busy}
        className="mt-3 w-full rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-line-strong disabled:opacity-50"
      >
        {t(locale, 'dup_keep_this')}
      </button>
    </div>
  );
}

export function DuplicatesClient({
  pairs,
  merges,
  locale,
  intlLocale,
}: {
  pairs: DupPair[];
  merges: MergeRow[];
  locale: Locale;
  intlLocale: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Pairs the person has dealt with in this session. The API recomputes from
  // the database on reload; this only stops a merged pair flashing back
  // before the refresh lands.
  const [done, setDone] = useState<Set<string>>(new Set());

  const key = (p: DupPair) => `${p.a.id}|${p.b.id}|${p.reason}`;

  function doMerge(pair: DupPair, keep: DupPerson, drop: DupPerson) {
    setError(null);
    startTransition(async () => {
      const res = await mergePeople(keep.id, drop.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone((s) => new Set(s).add(key(pair)));
      router.refresh();
    });
  }

  function doUndo(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await undoMerge(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone(new Set());
      router.refresh();
    });
  }

  const visible = pairs.filter((p) => !done.has(key(p)));
  const undoable = merges.filter((m) => !m.undone_at);

  return (
    <div className="mt-6 space-y-8">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {visible.length === 0 && (
        <p className="text-sm text-ink-muted">{t(locale, 'dup_none')}</p>
      )}

      {visible.map((pair) => (
        <div key={key(pair)} className="rounded-lg border border-line p-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
              {reasonLabel(locale, pair.reason)}
            </span>
          </div>

          {/* Stacks on a phone, side by side from sm up. */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <PersonCard
              person={pair.a}
              locale={locale}
              intlLocale={intlLocale}
              busy={pending}
              onKeep={() => doMerge(pair, pair.a, pair.b)}
            />
            <PersonCard
              person={pair.b}
              locale={locale}
              intlLocale={intlLocale}
              busy={pending}
              onKeep={() => doMerge(pair, pair.b, pair.a)}
            />
          </div>

          <p className="mt-3 text-xs text-ink-muted">{t(locale, 'dup_keep_explainer')}</p>
        </div>
      ))}

      {undoable.length > 0 && (
        <div>
          <h2 className="text-sm font-medium">{t(locale, 'dup_recent_merges')}</h2>
          <ul className="mt-2 space-y-2">
            {undoable.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-xs"
              >
                <Link href={`/contacts/${m.merged_person_id}`} className="hover:underline">
                  {m.merged_person_id.slice(0, 8)}
                </Link>
                <ArrowRight size={12} className="text-ink-muted" />
                <Link href={`/contacts/${m.kept_person_id}`} className="hover:underline">
                  {m.kept_person_id.slice(0, 8)}
                </Link>
                <span className="text-ink-muted">
                  {new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(
                    new Date(m.merged_at),
                  )}
                </span>
                {/* Rows a unique constraint would not let the merge carry —
                    surfaced so nobody has to guess what it cost. */}
                {m.dropped_rows > 0 && (
                  <span className="text-ink-muted">
                    · {t(locale, 'dup_dropped_rows')} {m.dropped_rows}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => doUndo(m.id)}
                  disabled={pending}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-medium hover:border-line-strong disabled:opacity-50"
                >
                  <Undo2 size={12} />
                  {t(locale, 'dup_undo')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
