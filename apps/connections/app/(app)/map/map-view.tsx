'use client';

// The desktop map. docs/connections-desktop.md.
//
// Two views on one page, chosen by the URL:
//
//   /map                        the cloud, around whoever you spoke to last
//   /map?focus=<id>             the cloud around one person (focus-web.tsx)
//   /map?focus=<id>&kind=org    ... or around one organisation
//   /map?view=all               everybody at once, as still dots
//
// THE CLOUD IS THE LANDING PAGE (Sjoerd, 2026-09-13). It used to be the dot
// overview, with the cloud one click in — and he twice reported not being able
// to see the thing he had asked for, because the page he arrived at was the
// old picture. What somebody wants on opening a map of their community is to
// be standing in it. The overview is still here, one click away, because
// "everybody at once" answers a different and real question.
//
// Sjoerd, 2026-09-11: *"I see a web of people.. connected. People who are
// active bigger.. people who I have not contacted or seen... far removed.. I
// click on a person.. zoom in... get info... but around it other people
// appear.."* — and 2026-09-13, on seeing the first version: *"Is the map not
// moving? Like the thesaurus..."*
//
// ── What each thing in the overview means (D39: four encodings) ────────────
//
//   distance from the centre   how long since you were in touch
//   size                       needs your attention now
//   depth of ink               how far along the ladder they are
//   the haze at the rim        people not seen in a year, as a count
//
// The overview never moves (lib/map-layout.ts, D38): where somebody lives on
// it is worth remembering. The web moves, because there the movement is the
// information.

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { defaultStartPerson, layout, type MapPerson } from '@/lib/map-layout';
import { t, type Locale } from '@/lib/i18n-ui';
import { FocusWeb, focusHref, type Focus } from './focus-web';

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

export function MapView({
  people,
  now,
  locale,
}: {
  people: MapPerson[];
  /** The server's clock, passed down: the component renders on the server
   *  and again in the browser, and two clocks put every dot a hair apart. */
  now: number;
  locale: Locale;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const focusId = params.get('focus');
  const focus: Focus | null = focusId
    ? { kind: params.get('kind') === 'org' ? 'org' : 'person', id: focusId }
    : null;

  const showAll = params.get('view') === 'all';

  // Where the cloud starts when nobody chose. No extra query: the overview
  // payload already carries the contact dates.
  const defaultStart = useMemo(() => defaultStartPerson(people), [people]);

  const { dots, far } = useMemo(() => layout(people, now), [people, now]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const [hover, setHover] = useState<string | null>(null);
  const [showFar, setShowFar] = useState(false);

  const start = (id: string) => router.push(focusHref({ kind: 'person', id }));

  const picker = (
    <select
      className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
      value=""
      onChange={(e) => e.target.value && start(e.target.value)}
    >
      <option value="">{t(locale, 'map_start_from')}</option>
      {[...people]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );

  // The cloud, either because a name was chosen or because this is the landing
  // page and somebody has to be in the middle.
  const shown: Focus | null = focus ?? (showAll || !defaultStart ? null : { kind: 'person', id: defaultStart.id });

  if (shown) {
    return (
      <>
        <div className="mt-4 max-w-xs">{picker}</div>
        {/* The same FocusWeb stays mounted as the focus changes, which is what
            lets the clicked name travel to the middle instead of jumping. */}
        <FocusWeb
          focus={shown}
          knownName={shown.kind === 'person' ? (nameOf.get(shown.id) ?? null) : null}
          locale={locale}
        />
      </>
    );
  }

  const px = (v: number) => Math.round(v * SIZE * 100) / 100;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="relative overflow-hidden rounded-lg border border-line bg-surface-raised">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block h-auto w-full" role="img" aria-label={t(locale, 'map_aria')}>
          <defs>
            {/* r = 71% reaches the corners, so the mist has no edge of its
                own; a circle ending at 50% drew exactly the ring this avoids. */}
            <radialGradient id="haze" cx="50%" cy="50%" r="71%">
              <stop offset="55%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.16" />
            </radialGradient>
          </defs>
          <rect width={SIZE} height={SIZE} fill="url(#haze)" className="text-ink" />

          {dots.map((d) => (
            <g key={d.id}>
              <circle
                cx={px(d.x)}
                cy={px(d.y)}
                r={px(d.size)}
                className="cursor-pointer text-ink"
                fill="currentColor"
                fillOpacity={RUNG_INK[d.rung ?? 'never'] ?? 0.3}
                onMouseEnter={() => setHover(d.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => start(d.id)}
              >
                <title>{d.name}</title>
              </circle>
              {hover === d.id && (
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
          ))}

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
          <h2 className="font-medium">{t(locale, 'map_near_title')}</h2>
          <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'map_near_hint')}</p>
          <div className="mt-2">{picker}</div>
        </section>

        <section>
          <h2 className="font-medium">{t(locale, 'map_legend_title')}</h2>
          <ul className="mt-2 space-y-1 text-xs text-ink-muted">
            <li>{t(locale, 'map_legend_distance')}</li>
            <li>{t(locale, 'map_legend_size')}</li>
            <li>{t(locale, 'map_legend_ink')}</li>
          </ul>
        </section>

        {showFar && (
          <section>
            <h2 className="font-medium">{t(locale, 'map_far_title')}</h2>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {far.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => start(p.id)} className="text-left text-xs hover:underline">
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
