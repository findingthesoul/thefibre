'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { countryName } from '@thefibre/shared/countries';
import {
  DuplicatesQueue,
  type DuplicatePair,
  type QueueMergeRow,
} from '@thefibre/shared/ui/duplicates-queue';
import { mergeOrganisations, undoOrgMerge, markOrgsDistinct, orgMergeConflicts } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type DupOrg = {
  id: string;
  name: string;
  domain?: string | null;
  legal_name?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  created_at?: string | null;
  /** How many people sit under this record. The single most useful number
   *  when deciding which of two is the real one. */
  people: number;
};

export type OrgDupPair = {
  reason: string;
  score: number;
  a: DupOrg;
  b: DupOrg;
};

export type OrgMergeRow = {
  id: string;
  kept_org_id: string;
  merged_org_id: string;
  merged_at: string;
  undone_at: string | null;
  dropped_rows: number;
};

// Column names are not words anybody should have to read. Only the ones an
// organisation merge can actually fill are listed; a column that appears
// without a label falls back to a de-underscored version of itself, which is
// ugly but honest — better than silently dropping a field from a question
// about which value wins.
//
// The fill derives its columns from the catalogue (20261011202050), so this
// list is deliberately NOT the source of truth about what moves: it is only
// how a column is spelled to a person.
const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  legal_name: 'legal name',
  short_name: 'abbreviation',
  other_names: 'other names',
  former_names: 'former names',
  domain: 'website domain',
  website: 'website',
  email: 'email',
  phone: 'phone',
  linkedin_url: 'LinkedIn',
  street: 'street',
  address: 'address',
  address_line1: 'address',
  address_line2: 'address',
  postcode: 'postcode',
  city: 'city',
  region: 'region',
  country: 'country',
  sector: 'sector',
  org_type: 'type',
  registration_number: 'registration number',
  tax_no: 'tax number',
  notes: 'notes',
  description: 'description',
  locale: 'language',
};

function fieldLabel(column: string): string {
  return FIELD_LABELS[column] ?? column.replace(/_/g, ' ');
}

// The candidates function names its reasons in words of its own, so these are
// its exact strings rather than codes. Explicit map rather than a computed
// `odup_reason_${…}` key: the catalog is typed, so a missing translation is a
// compile error, and a computed key throws that guarantee away.
const REASON_KEYS = {
  'same domain': 'odup_reason_same_domain',
  'same name': 'odup_reason_same_name',
  'one name contains the other': 'odup_reason_contains',
  'similar name': 'odup_reason_similar_name',
} as const;

function peopleLabel(locale: Locale, n: number) {
  if (n <= 0) return t(locale, 'odup_people_none');
  if (n === 1) return t(locale, 'odup_people_one');
  return t(locale, 'odup_people', { n });
}

/** The middle of an organisation's card: what this kind of record is compared
 *  on. Exported so a test can render it without the queue around it. */
export function OrgCardDetails({ org, locale }: { org: DupOrg; locale: Locale }) {
  const place = [org.city, countryName(org.country)].filter(Boolean).join(', ');
  // The domain is the strongest evidence the queue has, so it is shown even
  // when it is the reason the pair was proposed — somebody comparing two
  // records should see what matched, not have to take it on trust.
  const web = org.domain || org.website;
  return (
    <>
      {/* Only when it differs from the name — repeating it twice says nothing
          and makes the card harder to scan. */}
      {org.legal_name && org.legal_name !== org.name && (
        <div className="break-words">{org.legal_name}</div>
      )}
      {web && <div className="break-all">{web}</div>}
      {place && <div>{place}</div>}
      <div>{peopleLabel(locale, org.people)}</div>
    </>
  );
}

/**
 * Pairs in the queue's shape.
 *
 * NO aGains/bGains, and that is the point rather than an omission:
 * `organisation_duplicate_candidates` returns no gains columns, so nobody has
 * answered the question. Absent renders as silence; passing `[]` would claim
 * "gains nothing", which is a different and false statement — and is exactly
 * the bug v1.149.x fixed on the person side, where both records claimed to
 * gain nothing while one plainly had a phone and a city the other lacked.
 *
 * Exported so a test can assert the absence rather than trust this comment.
 */
export function toQueuePairs(pairs: OrgDupPair[]): DuplicatePair<DupOrg>[] {
  return pairs.map((p) => ({ reason: p.reason, a: p.a, b: p.b }));
}

/** person_merge and organisation_merge name their columns differently; the
 *  mapping happens here, once, rather than inside a component that would then
 *  have to know which table it had been given. */
export function toQueueMerges(merges: OrgMergeRow[]): QueueMergeRow[] {
  return merges.map((m) => ({
    id: m.id,
    keptId: m.kept_org_id,
    mergedId: m.merged_org_id,
    mergedAt: m.merged_at,
    undoneAt: m.undone_at,
    droppedRows: m.dropped_rows,
  }));
}

export function OrgDuplicatesClient({
  pairs,
  merges,
  locale,
  intlLocale,
}: {
  pairs: OrgDupPair[];
  merges: OrgMergeRow[];
  locale: Locale;
  intlLocale: string;
}) {
  const router = useRouter();

  return (
    <DuplicatesQueue<DupOrg>
      pairs={toQueuePairs(pairs)}
      merges={toQueueMerges(merges)}
      intlLocale={intlLocale}
      Link={Link}
      labelFor={fieldLabel}
      nameOf={(o) => o.name}
      hrefFor={(id) => `/organisations/${id}`}
      reasonLabel={(reason) => {
        const key = REASON_KEYS[reason as keyof typeof REASON_KEYS];
        return key ? t(locale, key) : reason;
      }}
      renderDetails={(org) => <OrgCardDetails org={org} locale={locale} />}
      renderMeta={(org) =>
        org.created_at
          ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(
              new Date(org.created_at),
            )
          : '—'
      }
      strings={{
        none: t(locale, 'dup_none'),
        question: t(locale, 'odup_question'),
        sameAnswer: t(locale, 'odup_same_org'),
        differentAnswer: t(locale, 'odup_different_orgs'),
        pickKeep: t(locale, 'odup_pick_keep'),
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
        // Never reached while no gains are passed, but supplied rather than
        // stubbed: the day the candidates function grows those columns this
        // screen should start saying the right thing without a hunt.
        gains: (fields) => t(locale, 'dup_gains', { fields }),
        gainsNone: t(locale, 'dup_gains_none'),
      }}
      actions={{
        fetchConflicts: orgMergeConflicts,
        merge: mergeOrganisations,
        undo: undoOrgMerge,
        markDistinct: markOrgsDistinct,
        afterChange: () => router.refresh(),
      }}
    />
  );
}
