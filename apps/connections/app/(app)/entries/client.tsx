'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { SearchSelect, type SearchSelectOption } from '@thefibre/shared/ui/search-select';
import { SectionLabel, ErrorBanner } from '@thefibre/shared/ui/page';
import { t, type Locale } from '@/lib/i18n-ui';

/** What the search offers. `hint` widens to null because the API returns
 *  null for an organisation with no sector — the shared option type only
 *  allows undefined, and mapping to it happens where the label is built. */
export type TargetOption = Omit<SearchSelectOption, 'hint'> & {
  kind: 'organisation' | 'person';
  hint: string | null;
};

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type Entry = {
  via_person_id: string;
  target_id: string;
  target_kind: 'organisation' | 'person';
  /** 1 or 2. Never 3 — one hop is an entry, two is a maybe, three is a
   *  coincidence with extra steps (docs/connections-model.md §3.6). */
  hops: number;
  /** A sentence, composed by the database out of this workspace's own names,
   *  dates and job titles. Never a score, and therefore never translated. */
  reason: string;
  /** The path runs through somebody marked `sceptic`: a warning, not an
   *  opportunity, and shown as one. */
  warning: boolean;
  strength: number;
  person: Person | null;
};

export type Related = { person_id: string; note: string; person: Person | null };

export type EntriesResult = {
  target: { id: string; kind: 'organisation' | 'person'; name: string } | null;
  items: Entry[];
  related: Related[];
  error?: string;
};

// Explicit maps, never a computed t() key — the catalog is typed so a missing
// translation is a compile error, and a template key throws that away.
const HOP_KEYS = {
  1: 'entries_hop_direct',
  2: 'entries_hop_two',
} as const;

const KIND_KEYS = {
  organisation: 'entries_kind_organisation',
  person: 'entries_kind_person',
} as const;

function name(p: Person | null, fallback: string) {
  if (!p) return fallback;
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || fallback;
}

export function EntriesClient({
  locale,
  contactsBase,
  searchTargets,
  findEntries,
}: {
  locale: Locale;
  /** Where a person's profile lives. Connections owns no person data of its
   *  own, so every name here links back to the platform. */
  contactsBase: string;
  searchTargets: (q: string) => Promise<TargetOption[]>;
  findEntries: (value: string) => Promise<EntriesResult>;
}) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<EntriesResult | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!value) {
      setResult(null);
      return;
    }
    start(async () => {
      setResult(await findEntries(value));
    });
  }, [value, findEntries]);

  const targetName = result?.target?.name ?? '';

  return (
    <div className="mt-6">
      {/* The whole entry point. An "all entries" list would be meaningless —
          an entry is only ever the answer to a question somebody asked. */}
      <div className="max-w-md">
        <SectionLabel>{t(locale, 'entries_search_hint')}</SectionLabel>
        <div className="mt-1.5">
          <SearchSelect
            value={value}
            onChange={setValue}
            placeholder={t(locale, 'entries_search_placeholder')}
            searchPlaceholder={t(locale, 'entries_search_placeholder')}
            loadOptions={async (q) => {
              const opts = await searchTargets(q);
              return opts.map((o) => {
                const kindLabel = t(locale, KIND_KEYS[o.kind]);
                return {
                  value: o.value,
                  label: o.label,
                  hint: o.hint ? `${kindLabel} · ${o.hint}` : kindLabel,
                };
              });
            }}
          />
        </div>
      </div>

      {pending && <p className="mt-6 text-sm text-ink-muted">{t(locale, 'entries_looking')}</p>}

      {!pending && result?.error && (
        <ErrorBanner>{t(locale, 'entries_error', { error: result.error })}</ErrorBanner>
      )}

      {!pending && result && !result.error && (
        <div className="mt-8">
          {result.items.length > 0 && (
            <>
              <h2 className="text-sm font-medium">
                {t(locale, 'entries_found', { target: targetName })}
                <span className="ml-2 text-ink-muted tabular-nums">{result.items.length}</span>
              </h2>
              {/* Ordered by path strength, which is the WEAKEST edge along the
                  path. The number itself is never shown: a score is a claim
                  the data cannot back (§3.6, D25). The ORDER is the claim and
                  the sentence underneath is the evidence for it. */}
              <ul className="mt-3 space-y-2">
                {result.items.map((e) => (
                  <li
                    key={e.via_person_id}
                    className={`rounded-md border bg-surface-raised px-3 py-3 ${
                      e.warning ? 'border-amber-400/70' : 'border-line'
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <Link
                        href={`${contactsBase}/contacts/${e.via_person_id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {name(e.person, e.via_person_id.slice(0, 8))}
                      </Link>
                      <span className="text-xs text-ink-muted">
                        {t(locale, HOP_KEYS[e.hops === 1 ? 1 : 2])}
                      </span>
                      {e.warning && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/70 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          {t(locale, 'entries_careful')}
                        </span>
                      )}
                    </div>
                    {/* Why, in words — and who it actually reaches, because
                        knowing the receptionist is not knowing the budget
                        holder. Wraps; never scrolls sideways. */}
                    <p className="mt-1 break-words text-xs text-ink-muted">{e.reason}</p>
                    {/* The ask is the product: a lookup that ends in a name
                        goes nowhere. */}
                    <p className="mt-2 flex items-start gap-1.5 text-xs">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-ink-muted" aria-hidden />
                      <span className="break-words">
                        {t(locale, 'entries_ask', {
                          person: name(e.person, '—'),
                          target: targetName,
                        })}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Degrade, never a dead end. "No path" is where somebody closes the
              tab; "no path, but three people are in the same sector" keeps
              them working (§3.6, "Cold start"). */}
          {result.items.length === 0 && (
            <div>
              <h2 className="text-sm font-medium">{t(locale, 'entries_none_title')}</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                {t(locale, 'entries_none_body', { target: targetName })}
              </p>

              {result.related.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-sm font-medium">{t(locale, 'entries_related_title')}</h3>
                  <p className="mt-1 max-w-2xl text-xs text-ink-muted">
                    {t(locale, 'entries_related_body')}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {result.related.map((r) => (
                      <li
                        key={r.person_id}
                        className="rounded-md border border-line bg-surface-raised px-3 py-2.5"
                      >
                        <Link
                          href={`${contactsBase}/contacts/${r.person_id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {name(r.person, r.person_id.slice(0, 8))}
                        </Link>
                        <p className="mt-1 break-words text-xs text-ink-muted">{r.note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-6 text-sm text-ink-muted">{t(locale, 'entries_nothing_at_all')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
