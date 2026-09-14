'use client';

// How you know somebody — the one thing about a person this app asks a human
// to answer, because it cannot be worked out from events.
//
// Sjoerd, 2026-09-13: *"see the CONNECTION card wirh absic info (maybe edit
// their relation fields)."* The reason it matters more than a nice-to-have is
// in relationship.ts's header: the landscape's `closeness` axis reads
// `relationship_strength`, and nothing in this app had ever written it, so
// that axis showed everybody as `unrated` for ever.
//
// ── One question at a time ─────────────────────────────────────────────────
//
// *"SHould this not be contextuel: At something: what (text) / Introduced:
// (search: person) / I reached out (nothing) / Through work: (search:
// company) / They reach out: nothing"*.
//
// He was right, and the reason is worth stating: the person picker used to sit
// under the list whatever you had chosen, so "Introduced by" appeared next to
// "At something" — which reads as a second, unrelated question rather than as
// the rest of the first one. Each way of meeting now asks for exactly what it
// needs, and two of the five ask for nothing.
//
// ── Every control saves itself ─────────────────────────────────────────────
//
// No Save button, because there is no form here — each control is a separate
// statement about a person, and the row is upserted per field. Somebody who
// has just put the phone down should be able to press "warm" and close the
// popup. A form would make that four actions instead of one, and the thing
// this app is trying to beat is the CRM nobody fills in.
//
// The exception is the free-text one, which saves on blur: a write per
// keystroke would be a hundred rows for one sentence.
//
// ── Two controls that were one ─────────────────────────────────────────────
//
// "Key contact" and "Speaks for us" used to be here. Sjoerd asked what they
// meant; reading the system, they did exactly ONE thing between them, and the
// same thing a closeness of `advocate` already does — put somebody on a
// ninety-day leash (`ambassador_drifting`). Three controls, one rule, and the
// only difference was which sentence the attention queue printed.
//
// He then said he still did not know what they meant WITH the explanation on
// screen, so they are gone rather than re-worded. Nothing is lost: the columns
// are untouched, anybody already flagged still trips the rule, and `advocate`
// says "speaks for us" in a control that has exactly one meaning. The concepts
// come back the day they behave differently — an ambassador going quiet being
// more urgent than a contact, or "key contact" living on the org membership
// where it is really a fact about a company (backlog §2.5).

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS, SelectField } from '@thefibre/shared/ui/fields';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { loadRelationship, saveRelationship } from '@/app/(app)/people/[id]/relationship';
// Values from the directive-free module, never from the 'use server' one:
// those arrive in the browser as proxies and `STRENGTHS.map` throws.
import {
  SOURCES,
  SOURCE_NEEDS,
  STRENGTHS,
  type Relationship,
  type Source,
  type Strength,
} from '@/app/(app)/people/[id]/relationship-vocab';
import { fetchVocabulary } from '@/app/(app)/people/[id]/actions';

// Explicit maps, never a computed `rel_strength_${k}` key — the catalog is
// typed so a missing translation is a compile error, and a template key throws
// that guarantee away.
const STRENGTH_KEYS: Record<Strength, UiKey> = {
  weak: 'band_weak',
  warm: 'band_warm',
  strong: 'band_strong',
  advocate: 'band_advocate',
};

const SOURCE_KEYS: Record<Source, UiKey> = {
  event_attendee: 'rel_source_event',
  referral: 'rel_source_referral',
  cold_outreach: 'rel_source_cold',
  client_contact: 'rel_source_client',
  inbound: 'rel_source_inbound',
};

const EMPTY: Relationship = {
  relationship_strength: null,
  source: null,
  source_detail: null,
  introduced_by: null,
  via_organisation_id: null,
  is_key_contact: false,
  is_ambassador: false,
};

export function RelationshipCard({
  personId,
  locale,
  /** Already loaded by the popup, which needs it to choose the opening tab. */
  initial,
}: {
  personId: string;
  locale: Locale;
  initial?: Relationship | null;
}) {
  const [value, setValue] = useState<Relationship | null>(initial ?? null);
  const [loaded, setLoaded] = useState(initial !== undefined);
  const [error, setError] = useState<string | null>(null);

  // Only when nobody handed it in. The popup does; a surface that drops this
  // card in on its own should not have to.
  useEffect(() => {
    if (initial !== undefined) return;
    let alive = true;
    setLoaded(false);
    void safely(
      () => loadRelationship(personId),
      (message) => ({ ok: false as const, error: message }),
    ).then((r) => {
      if (!alive) return;
      setLoaded(true);
      if (r.ok) setValue(r.relationship);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [personId, initial]);

  async function patch(p: Partial<Relationship>) {
    setError(null);
    const r = await safely(
      () => saveRelationship(personId, p),
      (message) => ({ ok: false as const, error: message }),
    );
    if (!r.ok) {
      setError(r.error === 'forbidden' ? t(locale, 'rel_forbidden') : r.error);
      return;
    }
    // Only once the write is back. A control that moved and then silently did
    // not save is worse than one that takes a moment.
    setValue((prev) => ({ ...EMPTY, ...(prev ?? {}), ...p }));
  }

  if (!loaded) return null;

  const strength = value?.relationship_strength ?? null;
  const source = value?.source ?? null;
  const needs = source ? SOURCE_NEEDS[source] : null;

  return (
    <section>
      {/* The shared fields, like every form in The Fibre (Sjoerd, 2026-09-14:
          one single point of truth, not a second smaller style). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t(locale, 'rel_strength')}
          value={strength ?? ''}
          // '' is the empty option and means unrated — a real answer, not an
          // absence, so it has to be choosable rather than only reachable by
          // undoing something.
          onChange={(e) => void patch({ relationship_strength: (e.target.value || null) as Strength | null })}
          options={[
            { value: '', label: t(locale, 'band_unrated') },
            ...STRENGTHS.map((s) => ({ value: s, label: t(locale, STRENGTH_KEYS[s]) })),
          ]}
          hint={!strength ? t(locale, 'rel_unrated') : undefined}
        />
        <SelectField
          label={t(locale, 'rel_source')}
          value={source ?? ''}
          // Changing HOW you met clears what the old answer needed. Leaving an
          // introducer behind on a relationship that now says "I reached out"
          // would be a fact nobody ever stated.
          onChange={(e) => {
            const next = (e.target.value || null) as Source | null;
            void patch({ source: next, source_detail: null, introduced_by: null, via_organisation_id: null });
          }}
          options={[
            { value: '', label: t(locale, 'rel_source_unknown') },
            ...SOURCES.map((s) => ({ value: s, label: t(locale, SOURCE_KEYS[s]) })),
          ]}
        />
      </div>

      {/* The rest of the question, when there is one. */}
      {needs === 'text' && (
        <label className="mt-4 block">
          <span className={FIELD_LABEL_CLASS}>
            {t(locale, source === 'event_attendee' ? 'rel_at_what' : 'rel_why')}
          </span>
          <TextDetail
            value={value?.source_detail ?? ''}
            placeholder={t(locale, source === 'event_attendee' ? 'rel_at_what_ph' : 'rel_why_ph')}
            onCommit={(v) => void patch({ source_detail: v || null })}
          />
        </label>
      )}

      {needs === 'person' && (
        <PickOne
          label={t(locale, 'rel_introduced_by')}
          placeholder={t(locale, 'rel_introduced_search')}
          locale={locale}
          kind="people"
          current={value?.introduced_by ?? null}
          exclude={[personId]}
          onPick={(id) => void patch({ introduced_by: id })}
        />
      )}

      {needs === 'organisation' && (
        <PickOne
          label={t(locale, 'rel_via_company')}
          placeholder={t(locale, 'rel_via_company_search')}
          locale={locale}
          kind="organisations"
          current={value?.via_organisation_id ?? null}
          exclude={[]}
          onPick={(id) => void patch({ via_organisation_id: id })}
        />
      )}

      {error && <p className="mt-2 text-xs text-ink">{error}</p>}
    </section>
  );
}

/**
 * A line of text that saves when you leave it.
 *
 * Not on every keystroke: this writes a row, and a row per character is a
 * hundred writes for one sentence. Not on Enter alone either — people close a
 * popup without pressing it, and losing what they typed is worse than an extra
 * write.
 */
function TextDetail({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // The row can change underneath — another field saved, the popup reloaded —
  // and the box should follow.
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== value.trim()) onCommit(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      placeholder={placeholder}
      maxLength={500}
      className={`mt-1 ${FIELD_INPUT_CLASS}`}
    />
  );
}

/**
 * Pick one person, or one company.
 *
 * Always an id, never a typed name (handbook §12: attach by identifier). Both
 * lists come from the vocabulary the `@` picker already reads, so there is one
 * answer to "who and what does this workspace know" rather than two that can
 * disagree.
 *
 * The results sit IN THE FLOW rather than floating: this card lives inside a
 * dialog, and a floating list opens into the dialog's bottom edge — the exact
 * bug the organisation popup shipped with on 2026-09-13.
 */
function PickOne({
  label,
  placeholder,
  locale,
  kind,
  current,
  exclude,
  onPick,
}: {
  label: string;
  placeholder: string;
  locale: Locale;
  kind: 'people' | 'organisations';
  current: string | null;
  exclude: string[];
  onPick: (id: string | null) => void;
}) {
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [term, setTerm] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchVocabulary().then((v) => {
      if (!alive) return;
      setOptions(
        kind === 'people'
          ? v.people
          : // A word that names an organisation carries its id; a word that is
            // only a tag does not, which is exactly how the two are told apart.
            v.words
              .filter((w) => w.organisationId)
              .map((w) => ({ id: w.organisationId!, name: w.name })),
      );
    });
    return () => {
      alive = false;
    };
  }, [kind]);

  const chosen = useMemo(() => options.find((o) => o.id === current) ?? null, [options, current]);

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    const skip = new Set(exclude);
    return options.filter((o) => !skip.has(o.id) && o.name.toLowerCase().includes(q)).slice(0, 6);
  }, [term, options, exclude]);

  return (
    <div className="mt-4">
      <span className={FIELD_LABEL_CLASS}>{label}</span>

      {current ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            {/* Before the vocabulary arrives the id is all there is. Showing
                it beats showing nothing, which would read as "not set". */}
            {chosen?.name ?? `${current.slice(0, 8)}…`}
          </span>
          <button type="button" onClick={() => onPick(null)} className="text-ink-muted hover:text-ink">
            {t(locale, 'rel_clear')}
          </button>
        </div>
      ) : (
        <div className="mt-1">
          <div className="relative">
            <Search
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className={`${FIELD_INPUT_CLASS} pl-9`}
            />
          </div>
          {term.trim() && (
            <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-line bg-surface py-1">
              {matches.length === 0 ? (
                <li className="px-3 py-1.5 text-sm text-ink-muted">{t(locale, 'people_none')}</li>
              ) : (
                matches.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPick(o.id);
                        setTerm('');
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-sunken"
                    >
                      {o.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
