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
// ── Every control saves itself ─────────────────────────────────────────────
//
// No Save button, because there is no form here — each control is a separate
// statement about a person, and the row is upserted per field. Somebody who
// has just put the phone down should be able to press "warm" and close the
// popup. A form would make that four actions instead of one, and the thing
// this app is trying to beat is the CRM nobody fills in.
//
// The cost is that a failure has to be visible without a Save button to attach
// it to, hence the per-row error line and the fact that the chip does not move
// until the write comes back.
//
// ── Unrated is an answer ───────────────────────────────────────────────────
//
// Pressing the chip that is already on clears it. `unrated` is a real band on
// the landscape rather than a silent default — calling four hundred unassessed
// people "weak" would be a judgement nobody made — so somebody must be able to
// put a person back into it, and the only honest control for that is the one
// they used to leave it.

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { loadRelationship, saveRelationship } from '@/app/(app)/people/[id]/relationship';
// Values from the directive-free module, never from the 'use server' one:
// those arrive in the browser as proxies and `STRENGTHS.map` throws.
import {
  SOURCES,
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

export function RelationshipCard({
  personId,
  locale,
  /** Somebody this person should never be able to be introduced by. */
  excludeId,
}: {
  personId: string;
  locale: Locale;
  excludeId?: string;
}) {
  const [value, setValue] = useState<Relationship | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [personId]);

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
    // Only once the write is back. A chip that moved and then silently did
    // not save is worse than one that takes a moment.
    setValue((prev) => ({
      relationship_strength: null,
      source: null,
      source_detail: null,
      introduced_by: null,
      is_key_contact: false,
      is_ambassador: false,
      ...(prev ?? {}),
      ...p,
    }));
  }

  if (!loaded) return null;

  const strength = value?.relationship_strength ?? null;
  const source = value?.source ?? null;

  return (
    <section className="mt-4 rounded-md border border-line bg-surface-raised px-3 py-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
        {t(locale, 'rel_title')}
      </h3>

      <div className="mt-2">
        <span className="text-xs text-ink-muted">{t(locale, 'rel_strength')}</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {STRENGTHS.map((s) => {
            const on = strength === s;
            return (
              <button
                key={s}
                type="button"
                // Pressing the one that is on clears it — back to unrated.
                onClick={() => void patch({ relationship_strength: on ? null : s })}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  on
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface text-ink-muted hover:text-ink'
                }`}
              >
                {t(locale, STRENGTH_KEYS[s])}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-subtle">
          {strength ? t(locale, 'rel_strength_clear') : t(locale, 'rel_unrated')}
        </p>
      </div>

      <div className="mt-3">
        <span className="text-xs text-ink-muted">{t(locale, 'rel_source')}</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SOURCES.map((s) => {
            const on = source === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => void patch({ source: on ? null : s })}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  on
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface text-ink-muted hover:text-ink'
                }`}
              >
                {t(locale, SOURCE_KEYS[s])}
              </button>
            );
          })}
        </div>
      </div>

      <IntroducedBy
        locale={locale}
        current={value?.introduced_by ?? null}
        excludeIds={[personId, ...(excludeId ? [excludeId] : [])]}
        onPick={(id) => void patch({ introduced_by: id })}
      />

      {/* What these two DO, on screen.
          Sjoerd, 2026-09-13: *"What does KEY CONTACT and SPEAKS FOR US
          mean?"* — a fair question about two checkboxes I put up without
          saying. Checked rather than explained from memory: between them they
          have exactly ONE effect. Either flag, or a closeness of `advocate`,
          puts somebody on a ninety-day leash — `ambassador_drifting` in
          connections_attention — so they surface in Attention as "an advocate
          drifting" if nobody has spoken to them in that time. Nothing else in
          the app reads either column.
          Which means the two are, today, the same switch with two names. That
          is a decision for Sjoerd (backlog §2.5), not something to paper over
          by writing two different-sounding sentences here. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value?.is_key_contact ?? false}
            onChange={(e) => void patch({ is_key_contact: e.target.checked })}
          />
          {t(locale, 'rel_key_contact')}
        </label>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value?.is_ambassador ?? false}
            onChange={(e) => void patch({ is_ambassador: e.target.checked })}
          />
          {t(locale, 'rel_ambassador')}
        </label>
      </div>
      <p className="mt-1.5 text-xs text-ink-subtle">{t(locale, 'rel_flags_what')}</p>

      {error && <p className="mt-2 text-xs text-ink">{error}</p>}
    </section>
  );
}

/**
 * Who introduced you.
 *
 * A person id, never a typed name (handbook §12: attach by identifier). The
 * field searches the workspace's own people and hands over an id; the results
 * sit in the flow rather than floating, because this card lives inside a
 * dialog and a floating list opens into its bottom edge — the exact bug the
 * organisation popup shipped with on 2026-09-13.
 */
function IntroducedBy({
  locale,
  current,
  excludeIds,
  onPick,
}: {
  locale: Locale;
  current: string | null;
  excludeIds: string[];
  onPick: (id: string | null) => void;
}) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [term, setTerm] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchVocabulary().then((v) => {
      if (alive) setPeople(v.people);
    });
    return () => {
      alive = false;
    };
  }, []);

  const chosen = useMemo(() => people.find((p) => p.id === current) ?? null, [people, current]);

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    const skip = new Set(excludeIds);
    return people.filter((p) => !skip.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [term, people, excludeIds]);

  return (
    <div className="mt-3">
      <span className="text-xs text-ink-muted">{t(locale, 'rel_introduced_by')}</span>

      {current ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            {/* Before the vocabulary arrives the id is all there is. Showing
                it beats showing nothing, which would read as "not set". */}
            {chosen?.name ?? `${current.slice(0, 8)}…`}
          </span>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="text-ink-muted hover:text-ink"
          >
            {t(locale, 'rel_clear')}
          </button>
        </div>
      ) : (
        <div className="mt-1.5">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t(locale, 'rel_introduced_search')}
              aria-label={t(locale, 'rel_introduced_search')}
              className="w-full rounded-md border border-line bg-surface py-1.5 pl-8 pr-3 text-xs placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
            />
          </div>
          {term.trim() && (
            <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-line bg-surface py-1">
              {matches.length === 0 ? (
                <li className="px-3 py-1.5 text-xs text-ink-muted">{t(locale, 'people_none')}</li>
              ) : (
                matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPick(p.id);
                        setTerm('');
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-sunken"
                    >
                      {p.name}
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
