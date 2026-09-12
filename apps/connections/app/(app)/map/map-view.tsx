'use client';

// The desktop map. docs/connections-desktop.md.
//
// Sjoerd, 2026-09-11: *"I see a web of people.. connected. People who are
// active bigger.. people who I have not contacted or seen... far removed.. I
// click on a person.. zoom in... get info... but around it other people
// appear.."*
//
// ── What each thing on screen means (D39: four encodings, the rest filters) ─
//
//   distance from the centre   how long since you were in touch
//   size                       needs your attention now
//   depth of ink               how far along the ladder they are
//   the haze at the rim        people not seen in a year, as a count
//
// ── Two clicks, two different things ────────────────────────────────────────
//
// Click a person: they open in the popup, over the map, like everywhere else.
// Choose "who is near" on the side: the map draws lines from them to the
// people who share something rare with them, each line saying why. The first
// is the person; the second is their neighbourhood. Keeping them apart is what
// stops "I wanted to read about Wilma" from rearranging the whole picture.
//
// ── The lines are reasons, not relationships ────────────────────────────────
//
// A line drawn because two people share a tag is NOT a claim that they know
// each other. system-handbook §12: a signal inferred from co-occurrence may be
// shown, never become the edge. So only a STATED relationship is drawn solid;
// shared tags, organisations and mentions are dashed, and every line's reason
// is written beside it. A picture that let those look the same would be the
// plausible edge the handbook warns about, drawn in ink.

import { useMemo, useState, useTransition } from 'react';
import { usePersonPopup } from '@/components/person-popup';
import { layout, thin, type MapPerson } from '@/lib/map-layout';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { loadNeighbourhood, type Neighbour, type Reason } from './actions';

const SIZE = 720; // the SVG's own coordinate space; CSS scales it

/** Depth of ink per rung — the landscape's grammar, never a status colour. */
const RUNG_INK: Record<string, number> = {
  never: 0.18,
  touched: 0.3,
  attended: 0.45,
  returned: 0.6,
  contributor: 0.78,
  facilitator: 0.95,
};

const REASON_KEYS: Record<Reason['kind'], UiKey> = {
  stated: 'map_reason_stated',
  tag: 'map_reason_tag',
  organisation: 'map_reason_organisation',
  mentioned: 'map_reason_mentioned',
};
const KINDS: Reason['kind'][] = ['stated', 'tag', 'organisation', 'mentioned'];

export function MapView({
  people,
  now,
  locale,
}: {
  people: MapPerson[];
  /** The server's clock, passed down. See below. */
  now: number;
  locale: Locale;
}) {
  const { openPerson } = usePersonPopup();
  // `now` comes from the server, not from Date.now() here. The component is
  // rendered twice, on the server and again in the browser to hydrate, and
  // two clocks a moment apart put every dot a hair apart: React reported a
  // hydration mismatch on the harness. One clock, passed down, is also the
  // stability the layout promises — nothing drifts on a re-render.
  const { dots, far } = useMemo(() => layout(people, now), [people, now]);
  const byId = useMemo(() => new Map(dots.map((d) => [d.id, d])), [dots]);

  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [neighbours, setNeighbours] = useState<Neighbour[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showFar, setShowFar] = useState(false);
  /**
   * Thinning (D47): each ticked kind is a REQUIREMENT. More ticks, fewer and
   * stronger links — the reverse of an ordinary filter, which widens with each
   * box. The design records that the obvious implementation does the opposite
   * and would look like a bug that is actually a misreading.
   */
  const [required, setRequired] = useState<Set<Reason['kind']>>(() => new Set());

  function showNeighbourhood(id: string) {
    setFocus(id);
    setFailed(false);
    startTransition(async () => {
      const r = await loadNeighbourhood(id);
      if (r.ok) setNeighbours(r.neighbours);
      else {
        setNeighbours([]);
        setFailed(true);
      }
    });
  }

  // D48: thinning happens here, in the browser, over what was already loaded.
  const visible = thin(neighbours, required);
  const maxWeight = Math.max(1, ...visible.map((n) => n.weight));
  const focusDot = focus ? byId.get(focus) : undefined;
  const focusName = focus
    ? (byId.get(focus)?.name ?? people.find((p) => p.id === focus)?.name ?? '')
    : '';

  // Rounded so the attribute the server writes and the one the browser
  // computes are the same string, not two floats that differ in digit 16.
  const px = (v: number) => Math.round(v * SIZE * 100) / 100;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="relative overflow-hidden rounded-lg border border-line bg-surface-raised">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="block h-auto w-full"
          role="img"
          aria-label={t(locale, 'map_aria')}
        >
          <defs>
            {/* The far field as mist that thickens toward the rim. No ring, no
                border — the geometry is felt, not seen (§5c). */}
            {/* r = 71% reaches the corners, so the mist has no edge of its
                own; a circle ending at 50% drew exactly the ring this avoids. */}
            <radialGradient id="haze" cx="50%" cy="50%" r="71%">
              <stop offset="55%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.16" />
            </radialGradient>
          </defs>

          <rect width={SIZE} height={SIZE} fill="url(#haze)" className="text-ink" />

          {/* Lines first, so the dots sit on top of them. */}
          {focusDot &&
            visible.map((n) => {
              const d = byId.get(n.id);
              // A neighbour in the haze has no dot to draw a line to; they are
              // still listed on the side, which is where the reasons live.
              if (!d) return null;
              const stated = n.reasons.some((r) => r.kind === 'stated');
              return (
                <line
                  key={n.id}
                  x1={px(focusDot.x)}
                  y1={px(focusDot.y)}
                  x2={px(d.x)}
                  y2={px(d.y)}
                  className="text-ink"
                  stroke="currentColor"
                  strokeOpacity={0.25 + 0.55 * (n.weight / maxWeight)}
                  strokeWidth={1 + 2.5 * (n.weight / maxWeight)}
                  strokeDasharray={stated ? undefined : '5 4'}
                />
              );
            })}

          {dots.map((d) => {
            const faded = focus && d.id !== focus && !visible.some((n) => n.id === d.id);
            return (
              <g key={d.id}>
                <circle
                  cx={px(d.x)}
                  cy={px(d.y)}
                  r={px(d.size)}
                  className="cursor-pointer text-ink"
                  fill="currentColor"
                  fillOpacity={(RUNG_INK[d.rung ?? 'never'] ?? 0.3) * (faded ? 0.25 : 1)}
                  stroke={d.id === focus ? 'currentColor' : 'none'}
                  strokeWidth={2}
                  onMouseEnter={() => setHover(d.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => openPerson(d.id)}
                >
                  <title>{d.name}</title>
                </circle>
                {(hover === d.id || d.id === focus) && (
                  <text
                    x={px(d.x)}
                    y={px(d.y) - px(d.size) - 6}
                    textAnchor="middle"
                    className="pointer-events-none fill-ink text-[13px] font-medium"
                  >
                    {d.name}
                  </text>
                )}
              </g>
            );
          })}

          {far.length > 0 && (
            <text
              x={SIZE / 2}
              y={SIZE - 18}
              textAnchor="middle"
              className="cursor-pointer fill-ink-muted text-[13px]"
              onClick={() => setShowFar((v) => !v)}
            >
              {t(locale, 'map_far', { n: far.length })}
            </text>
          )}
        </svg>
      </div>

      <aside className="space-y-5 text-sm">
        <section>
          <h2 className="font-medium">{t(locale, 'map_legend_title')}</h2>
          <ul className="mt-2 space-y-1 text-xs text-ink-muted">
            <li>{t(locale, 'map_legend_distance')}</li>
            <li>{t(locale, 'map_legend_size')}</li>
            <li>{t(locale, 'map_legend_ink')}</li>
            <li>{t(locale, 'map_legend_lines')}</li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium">{t(locale, 'map_near_title')}</h2>
          <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'map_near_hint')}</p>
          <select
            className="mt-2 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            value={focus ?? ''}
            onChange={(e) => (e.target.value ? showNeighbourhood(e.target.value) : setFocus(null))}
          >
            <option value="">{t(locale, 'map_near_pick')}</option>
            {[...people]
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>

          {focus && (
            <>
              <fieldset className="mt-3">
                <legend className="text-xs text-ink-subtle">{t(locale, 'map_thin_legend')}</legend>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {KINDS.map((k) => (
                    <label key={k} className="inline-flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={required.has(k)}
                        onChange={(e) =>
                          setRequired((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(k);
                            else next.delete(k);
                            return next;
                          })
                        }
                      />
                      {t(locale, REASON_KEYS[k])}
                    </label>
                  ))}
                </div>
              </fieldset>

              {pending && <p className="mt-3 text-xs text-ink-muted">{t(locale, 'loading')}</p>}
              {failed && <p className="mt-3 text-xs text-ink">{t(locale, 'map_near_failed')}</p>}
              {!pending && !failed && visible.length === 0 && (
                <p className="mt-3 text-xs text-ink-muted">
                  {t(locale, neighbours.length ? 'map_near_thinned' : 'map_near_none', {
                    name: focusName,
                  })}
                </p>
              )}

              <ul className="mt-3 space-y-2">
                {visible.map((n) => (
                  <li key={n.id} className="rounded-md border border-line px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => openPerson(n.id)}
                      className="text-left text-sm font-medium hover:underline"
                    >
                      {n.name}
                    </button>
                    {/* Every line says why it exists (D44). The reason is the
                        conversational hook, not decoration. */}
                    <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
                      {n.reasons.map((r, i) => (
                        <li key={i}>
                          {t(locale, REASON_KEYS[r.kind])}
                          {r.kind !== 'mentioned' && `: ${r.label}`}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {showFar && (
          <section>
            <h2 className="font-medium">{t(locale, 'map_far_title')}</h2>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {far.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openPerson(p.id)}
                    className="text-left text-xs hover:underline"
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
