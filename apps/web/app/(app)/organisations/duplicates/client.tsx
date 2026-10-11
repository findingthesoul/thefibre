'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Undo2, ArrowRight } from 'lucide-react';
import { countryName } from '@thefibre/shared/countries';
import {
  MergeConflictChoices,
  type MergeChoices,
  type MergeConflict,
} from '@thefibre/shared/ui/merge-conflicts';
import {
  mergeOrganisations,
  undoOrgMerge,
  markOrgsDistinct,
  orgMergeConflicts,
} from './actions';
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

/** One column, as a word. */
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

function reasonLabel(locale: Locale, reason: string) {
  const key = REASON_KEYS[reason as keyof typeof REASON_KEYS];
  return key ? t(locale, key) : reason;
}

function peopleLabel(locale: Locale, n: number) {
  if (n <= 0) return t(locale, 'odup_people_none');
  if (n === 1) return t(locale, 'odup_people_one');
  return t(locale, 'odup_people', { n });
}

function OrgCard({
  org,
  locale,
  onKeep,
  busy,
  intlLocale,
}: {
  org: DupOrg;
  locale: Locale;
  /** Only once "same organisation" was answered: keep this record. */
  onKeep: (() => void) | null;
  busy: boolean;
  intlLocale: string;
}) {
  const place = [org.city, countryName(org.country)].filter(Boolean).join(', ');
  // The domain is the strongest evidence the queue has, so it is shown even
  // when it is the reason the pair was proposed — a person comparing two
  // records should see what matched, not have to take it on trust.
  const web = org.domain || org.website;
  return (
    <div className="flex-1 rounded-md border border-line bg-surface-raised p-3">
      <Link
        href={`/organisations/${org.id}`}
        className="text-sm font-medium hover:underline break-words"
      >
        {org.name}
      </Link>
      <div className="mt-2 space-y-1 text-xs text-ink-subtle">
        {/* Only when it differs from the name — repeating it twice says
            nothing and makes the card harder to scan. */}
        {org.legal_name && org.legal_name !== org.name && (
          <div className="break-words">{org.legal_name}</div>
        )}
        {web && <div className="break-all">{web}</div>}
        {place && <div>{place}</div>}
        <div>{peopleLabel(locale, org.people)}</div>
      </div>
      <div className="mt-2 text-xs text-ink-muted">
        {org.created_at
          ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(
              new Date(org.created_at),
            )
          : '—'}
      </div>
      {onKeep && (
        <button
          type="button"
          onClick={onKeep}
          disabled={busy}
          className="mt-3 w-full rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-line-strong disabled:opacity-50"
        >
          {t(locale, 'dup_keep_this')}
        </button>
      )}
    </div>
  );
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /**
   * Said after a merge that went ahead WITHOUT asking, because the comparison
   * could not be fetched. Not an error — the merge is the plain one the merge
   * function has always made, and it is undoable. But a silent one would
   * leave somebody believing they had been asked and had no conflicts, which
   * is a different and false thing. (Same reasoning as v1.149.1 on the person
   * screen.)
   */
  const [notice, setNotice] = useState<string | null>(null);
  // Pairs dealt with in this session. The API recomputes from the database on
  // reload; this only stops a merged pair flashing back before that lands.
  const [done, setDone] = useState<Set<string>>(new Set());
  // The pair whose answer was "same organisation" — now choosing which to keep.
  const [choosing, setChoosing] = useState<string | null>(null);
  /**
   * The per-field step, open for one pair at a time. It appears ONLY when the
   * two records actually disagree: if they agree, the merge happens on the
   * click that chose the keeper, so the common case stays one press.
   */
  const [conflictStep, setConflictStep] = useState<{
    pairKey: string;
    keep: DupOrg;
    drop: DupOrg;
    conflicts: MergeConflict[];
    choices: MergeChoices;
  } | null>(null);

  const key = (p: OrgDupPair) => `${p.a.id}|${p.b.id}|${p.reason}`;

  function doDistinct(pair: OrgDupPair) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await markOrgsDistinct(pair.a.id, pair.b.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone((s) => new Set(s).add(key(pair)));
      router.refresh();
    });
  }

  /**
   * Chose which record to keep. Ask what the two disagree about BEFORE
   * merging: if they agree about everything there is nothing to ask, and the
   * merge happens on this click.
   */
  function chooseKeeper(pair: OrgDupPair, keep: DupOrg, drop: DupOrg) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await orgMergeConflicts(keep.id, drop.id);
      if (res.error) {
        // Merge anyway — refusing because a comparison failed would be the
        // worse answer, and the merge is undoable. But SAY SO.
        setNotice(t(locale, 'dup_conflict_unavailable', { name: keep.name }));
        await runMerge(pair, keep, drop);
        return;
      }
      const conflicts = res.conflicts ?? [];
      if (!conflicts.length) {
        await runMerge(pair, keep, drop);
        return;
      }
      setConflictStep({ pairKey: key(pair), keep, drop, conflicts, choices: {} });
    });
  }

  async function runMerge(
    pair: OrgDupPair,
    keep: DupOrg,
    drop: DupOrg,
    choices?: MergeChoices,
  ) {
    const res = await mergeOrganisations(keep.id, drop.id, choices);
    if (res.error) {
      setError(res.error);
      return;
    }
    setConflictStep(null);
    setChoosing(null);
    setDone((s) => new Set(s).add(key(pair)));
    router.refresh();
  }

  function doMerge(pair: OrgDupPair, keep: DupOrg, drop: DupOrg, choices?: MergeChoices) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      await runMerge(pair, keep, drop, choices);
    });
  }

  function doUndo(id: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await undoOrgMerge(id);
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

      {/* Deliberately NOT the danger styling: nothing went wrong for the
          person, and dressing an explanation as a failure invites them to undo
          a merge that is perfectly good. */}
      {notice && (
        <div className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink-subtle">
          {notice}
        </div>
      )}

      {visible.length === 0 && <p className="text-sm text-ink-muted">{t(locale, 'dup_none')}</p>}

      {visible.map((pair) => (
        <div key={key(pair)} className="rounded-lg border border-line p-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
              {reasonLabel(locale, pair.reason)}
            </span>
          </div>

          {/* Stacks on a phone, side by side from sm up. */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <OrgCard
              org={pair.a}
              locale={locale}
              intlLocale={intlLocale}
              busy={pending}
              onKeep={choosing === key(pair) ? () => chooseKeeper(pair, pair.a, pair.b) : null}
            />
            <OrgCard
              org={pair.b}
              locale={locale}
              intlLocale={intlLocale}
              busy={pending}
              onKeep={choosing === key(pair) ? () => chooseKeeper(pair, pair.b, pair.a) : null}
            />
          </div>

          {/* Both answered, differently — so ask, rather than silently keeping
              one. The keeper is pre-selected, so pressing Merge without
              touching anything does what a plain merge would. */}
          {conflictStep?.pairKey === key(pair) && (
            <>
              <MergeConflictChoices
                conflicts={conflictStep.conflicts}
                choices={conflictStep.choices}
                onChange={(choices) => setConflictStep((st) => (st ? { ...st, choices } : st))}
                labelFor={(column) => fieldLabel(column)}
                keepHeading={t(locale, 'dup_conflict_keeping', { name: conflictStep.keep.name })}
                mergeHeading={t(locale, 'dup_conflict_other', { name: conflictStep.drop.name })}
                intro={t(locale, 'dup_conflict_intro')}
                disabled={pending}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    doMerge(pair, conflictStep.keep, conflictStep.drop, conflictStep.choices)
                  }
                  disabled={pending}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-surface-sunken disabled:opacity-50"
                >
                  {t(locale, 'dup_conflict_merge')}
                </button>
                <button
                  type="button"
                  onClick={() => setConflictStep(null)}
                  disabled={pending}
                  className="text-xs text-ink-subtle underline"
                >
                  {t(locale, 'dup_back')}
                </button>
              </div>
            </>
          )}

          {/* Once the per-field step is open, the keeper HAS been chosen — so
              the explainer asking which record to keep, and its Back, are
              answering a question that is no longer on screen. Leaving them
              there put two "Back" links a few millimetres apart, one closing
              the step and one leaving the choice, and on a phone the stale
              paragraph sits directly under "Merge with these answers". Seen
              in the browser at both widths. REMOVE IN THE DuplicatesQueue
              EXTRACTION: the person screen carries the identical guard
              (v1.151.2), and the shared component should carry it once. */}
          {choosing === key(pair) && conflictStep?.pairKey !== key(pair) ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-ink-muted flex-1">{t(locale, 'odup_pick_keep')}</p>
              <button
                type="button"
                onClick={() => setChoosing(null)}
                disabled={pending}
                className="text-xs text-ink-subtle underline"
              >
                {t(locale, 'dup_back')}
              </button>
            </div>
          ) : conflictStep?.pairKey === key(pair) ? null : (
            <div className="mt-3">
              <p className="text-sm font-medium">{t(locale, 'odup_question')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setChoosing(key(pair))}
                  disabled={pending}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-surface-sunken disabled:opacity-50"
                >
                  {t(locale, 'odup_same_org')}
                </button>
                <button
                  type="button"
                  onClick={() => doDistinct(pair)}
                  disabled={pending}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-line-strong disabled:opacity-50"
                >
                  {t(locale, 'odup_different_orgs')}
                </button>
              </div>
            </div>
          )}
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
                <Link href={`/organisations/${m.merged_org_id}`} className="hover:underline">
                  {m.merged_org_id.slice(0, 8)}
                </Link>
                <ArrowRight size={12} className="text-ink-muted" />
                <Link href={`/organisations/${m.kept_org_id}`} className="hover:underline">
                  {m.kept_org_id.slice(0, 8)}
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
