'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ContactPointsView, type ContactPointValue } from '@thefibre/shared/ui/contact-points';
import { countryName } from '@thefibre/shared/countries';
import {
  DuplicatesQueue,
  type DuplicatePair,
  type QueueMergeRow,
} from '@thefibre/shared/ui/duplicates-queue';
import { mergePeople, undoMerge, markDistinct, mergeConflicts } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type DupPerson = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  created_at?: string | null;
  created_via?: string | null;
  city?: string | null;
  country?: string | null;
  contact_points?: ContactPointValue[];
  organisations?: string[];
};

export type DupPair = {
  reason: string;
  score: number;
  a: DupPerson;
  b: DupPerson;
  /** Column names each record would GAIN if it were the one kept. From the
   *  database, which decides it with the same rules the merge then applies —
   *  never recomputed here from the handful of fields this page fetches. */
  a_gains?: string[];
  b_gains?: string[];
};

export type MergeRow = {
  id: string;
  kept_person_id: string;
  merged_person_id: string;
  merged_at: string;
  undone_at: string | null;
  dropped_rows: number;
};

// Column names are not words anybody should have to read. Only the ones a
// merge can actually fill are listed; a column that appears here without a
// label falls back to a de-underscored version of itself, which is ugly but
// honest — better than silently dropping a field from a promise about what
// moves.
const FIELD_LABELS: Record<string, string> = {
  email: 'email',
  email_secondary: 'second email',
  phone: 'phone',
  phone_secondary: 'second phone',
  first_name: 'first name',
  last_name: 'last name',
  address: 'address',
  address_line1: 'address',
  address_line2: 'address',
  postcode: 'postcode',
  city: 'city',
  country: 'country',
  notes: 'notes',
  job_title: 'job title',
  website: 'website',
  linkedin_url: 'LinkedIn',
  pronouns: 'pronouns',
  languages: 'languages',
};

function fieldLabel(column: string): string {
  return FIELD_LABELS[column] ?? column.replace(/_/g, ' ');
}

export function displayName(p: DupPerson) {
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return n || p.email || p.id.slice(0, 8);
}

// Explicit maps rather than `dup_reason_${reason}` template keys: the catalog
// is typed so a missing translation is a compile error, and a computed key
// throws that guarantee away exactly where it is most useful.
const REASON_KEYS = {
  same_email: 'dup_reason_same_email',
  shared_address: 'dup_reason_shared_address',
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

/** How a record arrived. Null for everything created before v0.70.0, which is
 *  honest — we genuinely do not know. A source added to PersonSource but not
 *  to SOURCE_KEYS falls back to its raw name rather than a blank. */
function sourceLabel(locale: Locale, via: string | null | undefined) {
  if (!via) return t(locale, 'dup_source_unknown');
  const key = SOURCE_KEYS[via as keyof typeof SOURCE_KEYS];
  return key ? t(locale, key) : via.replace(/_/g, ' ');
}

/** The middle of a person's card: everything that helps somebody decide —
 *  every address with its label, where they work, where they live. */
export function PersonCardDetails({ person }: { person: DupPerson }) {
  const points = person.contact_points ?? [];
  const place = [person.city, countryName(person.country)].filter(Boolean).join(', ');
  return (
    <>
      {points.length ? (
        <>
          <ContactPointsView points={points} kind="email" />
          {points.some((p) => p.kind === 'phone') && (
            <ContactPointsView points={points} kind="phone" />
          )}
        </>
      ) : (
        <div className="break-all">{person.email ?? '—'}</div>
      )}
      {!!person.organisations?.length && <div>{person.organisations.join(' · ')}</div>}
      {place && <div>{place}</div>}
    </>
  );
}

/**
 * Pairs in the queue's shape.
 *
 * Unlike organisations, a person pair DOES carry gains, and they are passed
 * through exactly as they arrived — `undefined` when the API did not answer,
 * `[]` when it answered "nothing". Those mean different things and
 * `mergeGains` keeps them apart; never coalesce one into the other here.
 */
export function toQueuePairs(pairs: DupPair[]): DuplicatePair<DupPerson>[] {
  return pairs.map((p) => ({
    reason: p.reason,
    a: p.a,
    b: p.b,
    aGains: p.a_gains,
    bGains: p.b_gains,
  }));
}

export function toQueueMerges(merges: MergeRow[]): QueueMergeRow[] {
  return merges.map((m) => ({
    id: m.id,
    keptId: m.kept_person_id,
    mergedId: m.merged_person_id,
    mergedAt: m.merged_at,
    undoneAt: m.undone_at,
    droppedRows: m.dropped_rows,
  }));
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

  return (
    <DuplicatesQueue<DupPerson>
      pairs={toQueuePairs(pairs)}
      merges={toQueueMerges(merges)}
      intlLocale={intlLocale}
      Link={Link}
      labelFor={fieldLabel}
      nameOf={displayName}
      hrefFor={(id) => `/contacts/${id}`}
      reasonLabel={(reason) => {
        const key = REASON_KEYS[reason as keyof typeof REASON_KEYS];
        return key ? t(locale, key) : reason.replace(/_/g, ' ');
      }}
      renderDetails={(person) => <PersonCardDetails person={person} />}
      renderMeta={(person) => (
        <>
          {person.created_at
            ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(
                new Date(person.created_at),
              )
            : '—'}
          {' · '}
          {sourceLabel(locale, person.created_via)}
        </>
      )}
      strings={{
        none: t(locale, 'dup_none'),
        // The question (Sjoerd, 2026-09-15): same person with different roles,
        // or different people with the same name?
        question: t(locale, 'dup_question'),
        sameAnswer: t(locale, 'dup_same_person'),
        differentAnswer: t(locale, 'dup_different_people'),
        pickKeep: t(locale, 'dup_pick_keep'),
        keepThis: t(locale, 'dup_keep_this'),
        back: t(locale, 'dup_back'),
        conflictIntro: t(locale, 'dup_conflict_intro'),
        conflictKeeping: (name) => t(locale, 'dup_conflict_keeping', { name }),
        conflictOther: (name) => t(locale, 'dup_conflict_other', { name }),
        conflictMerge: t(locale, 'dup_conflict_merge'),
        conflictUnavailable: (name) => t(locale, 'dup_conflict_unavailable', { name }),
        recentMerges: t(locale, 'dup_recent_merges'),
        undo: t(locale, 'dup_undo'),
        droppedRows: t(locale, 'dup_dropped_rows'),
        gains: (fields) => t(locale, 'dup_gains', { fields }),
        gainsNone: t(locale, 'dup_gains_none'),
      }}
      actions={{
        fetchConflicts: mergeConflicts,
        merge: mergePeople,
        undo: undoMerge,
        markDistinct,
        afterChange: () => router.refresh(),
      }}
    />
  );
}
