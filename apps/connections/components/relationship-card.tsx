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
import { PersonCombobox } from '@thefibre/shared/ui/person-combobox';
import { OrganisationCombobox } from '@thefibre/shared/ui/organisation-combobox';
import {
  searchPeople,
  searchOrganisations,
  createPersonNamed,
  createOrganisationNamed,
  getPerson,
  getOrganisation,
} from '@/lib/person-picker';
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
import { usePersonPopup } from '@/components/person-popup';
import { useOrgPopup } from '@/components/org-popup';

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

      {/* THE pickers, not a third pair. Sjoerd, 2026-09-22: "There should be
          a Single Point of truth — it is existing somewhere else", and then
          "Add company - also a single point of truth". Both components live
          in @thefibre/shared and are bound here to Connect's own search, so
          every result passes this reader's RLS. Both can create what you
          typed when it is not there yet. */}
      {needs === 'person' && (
        <div className="mt-4">
          <PersonCombobox
            label={t(locale, 'rel_introduced_by')}
            search={searchPeople}
            resolve={getPerson}
            exclude={[personId]}
            value={value?.introduced_by ?? ''}
            onChange={(id) => void patch({ introduced_by: id || null })}
            placeholder={t(locale, 'rel_introduced_search')}
            searchPlaceholder={t(locale, 'rel_introduced_search')}
            onCreate={(typed) => {
              void createPersonNamed(typed).then((r) => {
                if (r.ok) void patch({ introduced_by: r.person.id });
              });
            }}
            createLabel={(typed) => t(locale, 'rel_add_person', { name: typed })}
          />
        </div>
      )}

      {needs === 'organisation' && (
        <div className="mt-4">
          <OrganisationCombobox
            label={t(locale, 'rel_via_company')}
            search={searchOrganisations}
            resolve={getOrganisation}
            value={value?.via_organisation_id ?? ''}
            onChange={(id) => void patch({ via_organisation_id: id || null })}
            placeholder={t(locale, 'rel_via_company_search')}
            searchPlaceholder={t(locale, 'rel_via_company_search')}
            onCreate={(typed) => {
              void createOrganisationNamed(typed).then((r) => {
                if (r.ok) void patch({ via_organisation_id: r.organisation.id });
              });
            }}
            createLabel={(typed) => t(locale, 'rel_add_company', { name: typed })}
          />
        </div>
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

