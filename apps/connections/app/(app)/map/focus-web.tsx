'use client';

// The moving web. Sjoerd, 2026-09-13: *"a moving web of connection. You click
// on a name (not a dot) and then you see the connections.. you click on the
// next... and that one is centered (and bigger) and you see the most valuable
// connection of that person... you can always go Back."* And: *"company needs
// to be connected to the person."*
//
// ── How it behaves ──────────────────────────────────────────────────────────
//
//   * The person (or organisation) in the middle is larger. Their strongest
//     connections float around them, nearest = most valuable.
//   * Click a name: that name travels to the middle and the web rebuilds
//     around it. The movement is the point — you see where you came from.
//   * Click the name in the middle: their details open in the popup.
//   * Back is the browser's Back. The focus lives in the URL, so it also
//     works from the keyboard, a swipe, or a shared link.
//
// ── Solid and dashed, as everywhere on the map ─────────────────────────────
//
// A solid line is RECORDED: a stated relationship, or somebody's current
// organisation. A dashed line is only something two people share — a tag, an
// organisation, being named in the same note — and says so underneath the
// name. Sharing a word is not knowing someone (system-handbook §12).

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { usePersonPopup } from '@/components/person-popup';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import {
  R_MAX,
  fontSize,
  labelWidth,
  panTo,
  panning,
  seedPosition,
  settle,
  step,
  targetRadius,
  type Pan,
  type WebLink,
  type WebNode,
} from '@/lib/web-layout';
import { thin } from '@/lib/map-layout';
import { loadNeighbourhood, loadOrganisation, type Link, type Reason } from './actions';

export type Focus = { kind: 'person' | 'org'; id: string };

/** The most names a web shows around its centre. More stops being legible. */
const MAX_AROUND = 12;

type Shown = WebNode & {
  kind: 'person' | 'org';
  label: string;
  /** One short line under the name: why they are here. */
  sub: string;
  solid: boolean;
  /** 0..1, for line thickness. */
  strength: number;
  reasons: Reason[];
  /** The person you came from, kept on screen even when they are not in the
   *  new person's list, so the way back is always visible. */
  trail?: boolean;
};

const REASON_KEYS: Record<Reason['kind'], UiKey> = {
  stated: 'map_reason_stated',
  tag: 'map_reason_tag',
  organisation: 'map_reason_organisation',
  mentioned: 'map_reason_mentioned',
};
const KINDS: Reason['kind'][] = ['stated', 'tag', 'organisation', 'mentioned'];

export const focusHref = (f: Focus, base = '/map') =>
  `${base}?focus=${f.id}${f.kind === 'org' ? '&kind=org' : ''}`;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type Loaders = { neighbourhood: typeof loadNeighbourhood; organisation: typeof loadOrganisation };
const SERVER: Loaders = { neighbourhood: loadNeighbourhood, organisation: loadOrganisation };

export function FocusWeb({
  focus,
  knownName,
  locale,
  loaders = SERVER,
}: {
  focus: Focus;
  /** The name if the page already knows it, so the centre is labelled at once. */
  knownName: string | null;
  locale: Locale;
  /** The server actions, unless a preview supplies its own data. */
  loaders?: Loaders;
}) {
  const router = useRouter();
  // The page this web lives on, so its links stay on it.
  const pathname = usePathname();
  const { openPerson } = usePersonPopup();
  const nodes = useRef<Map<string, Shown>>(new Map());
  const [, setFrame] = useState(0);
  const [centreName, setCentreName] = useState(knownName ?? '');
  const [status, setStatus] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [allReasons, setAllReasons] = useState<Map<string, Reason[]>>(new Map());
  // How the names around the centre are tied to EACH OTHER. Sjoerd: "some
  // words are not only connected to the central word, but also to other words
  // that are shown".
  const links = useRef<Link[]>([]);
  // Translation the cloud still owes, so a click slides everything instead of
  // teleporting the clicked name (lib/web-layout.ts, the glide).
  const pan = useRef<Pan | undefined>(undefined);
  const [required, setRequired] = useState<Set<Reason['kind']>>(() => new Set());
  const raf = useRef<number | null>(null);

  // ── The animation loop ──────────────────────────────────────────────────
  const animate = useCallback(() => {
    if (raf.current !== null) return;
    if (prefersReducedMotion()) {
      settle([...nodes.current.values()], 600, webLinks(links.current), pan.current);
      setFrame((f) => f + 1);
      return;
    }
    const tick = () => {
      const energy = step([...nodes.current.values()], webLinks(links.current), pan.current);
      setFrame((f) => f + 1);
      raf.current = energy > 0.01 || panning(pan.current) ? requestAnimationFrame(tick) : null;
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // ── A new focus ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const map = nodes.current;

    // Straight away, before any data: whoever was clicked starts travelling to
    // the middle, and the old centre steps back. Waiting for the network
    // before moving anything would make the click feel ignored.
    const clicked = map.get(focus.id);
    const previous = [...map.values()].find((n) => n.centre && n.id !== focus.id) ?? null;
    // Slide the whole cloud so the clicked name ends up in the middle. This is
    // what puts the name you came FROM on the opposite side, for free.
    pan.current = clicked ? panTo(clicked) : undefined;
    for (const n of map.values()) {
      n.centre = n.id === focus.id;
      // Whoever is in the middle is never the faded "way back" name, even if
      // they were a moment ago.
      if (n.centre) n.trail = false;
      n.targetR = n.centre ? 0 : R_MAX;
      n.width = labelWidth(n.label, n.centre, n.strength);
    }
    if (!clicked) {
      map.clear();
      map.set(focus.id, {
        id: focus.id, x: 0, y: 0, vx: 0, vy: 0, targetR: 0, centre: true,
        width: labelWidth(knownName ?? '', true, 1), kind: focus.kind,
        label: knownName ?? '', sub: '', solid: true, strength: 1, reasons: [],
      });
    } else {
      setCentreName(clicked.label);
    }
    setStatus('loading');
    animate();

    const place = (
      around: { id: string; kind: 'person' | 'org'; label: string; sub: string; solid: boolean; strength: number; reasons: Reason[]; trail?: boolean }[],
    ) => {
      const centre = map.get(focus.id)!;
      if (previous && map.has(previous.id) && !around.some((a) => a.id === previous.id)) {
        around = [
          ...around,
          {
            id: previous.id, kind: previous.kind, label: previous.label, sub: '',
            solid: false, strength: 0, reasons: [], trail: true,
          },
        ];
      }
      const keep = new Set([focus.id, ...around.map((a) => a.id)]);
      for (const id of [...map.keys()]) if (!keep.has(id)) map.delete(id);
      for (const a of around) {
        const existing = map.get(a.id);
        const targetR = targetRadius(a.strength, 1);
        if (existing) {
          Object.assign(existing, {
            trail: false, ...a, targetR, centre: false,
            width: labelWidth(a.label, false, a.strength),
          });
        } else {
          map.set(a.id, {
            ...a, ...seedPosition(a.id, centre), vx: 0, vy: 0, targetR, centre: false,
            width: labelWidth(a.label, false, a.strength),
          });
        }
      }
      animate();
    };

    void (async () => {
      if (focus.kind === 'person') {
        const r = await loaders.neighbourhood(focus.id);
        if (!alive) return;
        if (!r.ok) return setStatus('failed');
        const max = Math.max(1, ...r.neighbours.map((n) => n.weight));
        setAllReasons(new Map(r.neighbours.map((n) => [n.id, n.reasons])));
        links.current = r.links;
        // Organisations first: they are recorded facts about THIS person and
        // are never thinned away by a checkbox about shared attributes.
        place([
          ...r.organisations.map((o) => ({
            id: o.id, kind: 'org' as const, label: o.name, sub: o.title ?? '',
            solid: true, strength: 1, reasons: [],
          })),
          ...r.neighbours.slice(0, MAX_AROUND - Math.min(r.organisations.length, 4)).map((n) => ({
            id: n.id, kind: 'person' as const, label: n.name,
            sub: n.reasons[0] ? reasonLine(n.reasons[0], locale) : '',
            solid: n.reasons.some((x) => x.kind === 'stated'),
            strength: n.weight / max, reasons: n.reasons,
          })),
        ]);
      } else {
        const r = await loaders.organisation(focus.id);
        if (!alive) return;
        if (!r.ok) return setStatus('failed');
        setCentreName(r.organisation.name);
        const c = map.get(focus.id);
        if (c) {
          c.label = r.organisation.name;
          c.kind = 'org';
          c.width = labelWidth(c.label, true);
        }
        setAllReasons(new Map());
        links.current = r.links;
        place(
          r.members.slice(0, MAX_AROUND).map((m) => ({
            id: m.id, kind: 'person' as const, label: m.name, sub: m.title ?? '',
            // A membership is recorded, so every line to a member is solid.
            solid: true, strength: 0.6, reasons: [],
          })),
        );
      }
      if (alive) setStatus('ok');
    })();

    return () => {
      alive = false;
    };
    // knownName is read once per focus on purpose; locale only phrases subs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.id, focus.kind]);

  // Keep the centre's label once the neighbourhood reveals it (a person
  // reached from the URL has no name until the first read).
  const centre = nodes.current.get(focus.id);
  if (centre && !centre.label && centreName) {
    centre.label = centreName;
    centre.width = labelWidth(centreName, true, 1);
  }

  // Thinning applies to people only; organisations are facts, not reasons.
  const visiblePeople = new Set(
    thin(
      [...allReasons.entries()].map(([id, reasons]) => ({ id, reasons })),
      required,
    ).map((x) => x.id),
  );
  const shown = [...nodes.current.values()].filter(
    (n) => n.centre || n.trail || n.kind === 'org' || focus.kind === 'org' || visiblePeople.has(n.id),
  );
  const around = shown.filter((n) => !n.centre);

  // Links whose BOTH ends are currently on screen. A link to somebody thinned
  // away, or not drawn at all, is simply not shown — never a line to nowhere.
  const onScreen = new Map(shown.map((n) => [n.id, n]));
  const crossLines = links.current.flatMap((l) => {
    const a = onScreen.get(l.a);
    const b = onScreen.get(l.b);
    if (!a || !b || a.centre || b.centre) return [];
    return [{
      a,
      b,
      weight: l.weight,
      solid: l.reasons.some((r) => r.kind === 'stated'),
      why: l.reasons.map((r) => (r.kind === 'tag' ? `#${r.label}` : r.label)).join(', '),
    }];
  });

  const go = (n: Shown) => {
    if (n.centre) {
      if (n.kind === 'person') openPerson(n.id);
      return;
    }
    router.push(focusHref({ kind: n.kind, id: n.id }, pathname));
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 hover:bg-surface-sunken"
        >
          <ArrowLeft size={14} /> {t(locale, 'map_back')}
        </button>
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="rounded-md px-2 py-1.5 text-ink-muted hover:text-ink"
        >
          {t(locale, 'map_overview')}
        </button>
        <span className="text-xs text-ink-subtle">{t(locale, 'map_web_hint')}</span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
          <svg viewBox="-390 -285 780 570" className="block h-auto w-full touch-manipulation" role="img" aria-label={centreName}>
            {/* Between the people around the centre. Drawn first and faintest:
                they are the shape of the group, not the answer to "who is near
                this person", which is the star below. A shared tag is dashed —
                sharing a word is not knowing someone (handbook §12). */}
            {crossLines.map((l) => (
              <line
                key={`x-${l.a.id}-${l.b.id}`}
                x1={round(l.a.x)}
                y1={round(l.a.y)}
                x2={round(l.b.x)}
                y2={round(l.b.y)}
                className="text-ink"
                stroke="currentColor"
                strokeOpacity={0.1 + 0.18 * Math.min(1, l.weight)}
                strokeWidth={0.8 + 1.2 * Math.min(1, l.weight)}
                strokeDasharray={l.solid ? undefined : '4 5'}
              >
                <title>{l.why}</title>
              </line>
            ))}
            {around.map((n) => (
              <line
                key={`l-${n.id}`}
                x1={round(centre?.x ?? 0)}
                y1={round(centre?.y ?? 0)}
                x2={round(n.x)}
                y2={round(n.y)}
                className="text-ink"
                stroke="currentColor"
                strokeOpacity={0.18 + 0.4 * n.strength}
                strokeWidth={1 + 2 * n.strength}
                strokeDasharray={n.solid ? undefined : '5 5'}
              />
            ))}
            {shown.map((n) => (
              <g
                key={n.id}
                transform={`translate(${round(n.x)} ${round(n.y)})`}
                className="cursor-pointer"
                opacity={n.trail ? 0.55 : 1}
                onClick={() => go(n)}
                role="button"
                aria-label={n.label}
              >
                {/* A label needs a ground, or a line drawn behind it strikes
                    the name through. Organisations get a visible outline, so a
                    company never reads as a person. */}
                <rect
                  x={-n.width / 2}
                  y={n.centre ? -20 : n.sub ? -14 : -13}
                  width={n.width}
                  height={n.centre ? 40 : n.sub ? 34 : 26}
                  rx={n.kind === 'org' ? 4 : 13}
                  className={n.kind === 'org' ? 'fill-surface stroke-line-strong' : 'fill-surface-raised'}
                  strokeWidth={n.kind === 'org' ? 1.2 : 0}
                />
                {/* Bigger name, stronger connection (Sjoerd: "Some words are
                    bigger and some are smaller"). */}
                <text
                  textAnchor="middle"
                  y={n.centre ? 7 : n.sub ? 1 : 5}
                  fontSize={fontSize(n.strength, n.centre)}
                  className={`fill-ink ${n.centre ? 'font-semibold' : 'font-medium hover:underline'}`}
                >
                  {n.label || '…'}
                </text>
                {!n.centre && n.sub && (
                  <text textAnchor="middle" y={15} className="fill-ink-muted text-[10.5px]">
                    {truncate(n.sub, 30)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        <aside className="space-y-4 text-sm">
          {status === 'loading' && <p className="text-xs text-ink-muted">{t(locale, 'loading')}</p>}
          {status === 'failed' && <p className="text-xs text-ink">{t(locale, 'map_near_failed')}</p>}
          {status === 'ok' && around.length === 0 && (
            <p className="text-xs text-ink-muted">
              {focus.kind === 'org'
                ? t(locale, 'map_org_empty')
                : allReasons.size && required.size
                  ? t(locale, 'map_near_thinned')
                  : t(locale, 'map_near_none', { name: centreName })}
            </p>
          )}

          {focus.kind === 'person' && (
            <fieldset>
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
          )}

          <ul className="space-y-1.5 text-xs text-ink-muted">
            <li>{t(locale, 'map_web_legend_near')}</li>
            <li>{t(locale, 'map_legend_lines')}</li>
            <li>{t(locale, 'map_web_legend_org')}</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

function reasonLine(r: Reason, locale: Locale): string {
  if (r.kind === 'tag') return `#${r.label}`;
  if (r.kind === 'mentioned') return t(locale, 'map_reason_mentioned');
  return r.label;
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Only what the simulation needs from a link. */
function webLinks(links: Link[]): WebLink[] {
  return links.map((l) => ({ a: l.a, b: l.b, weight: l.weight }));
}
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
