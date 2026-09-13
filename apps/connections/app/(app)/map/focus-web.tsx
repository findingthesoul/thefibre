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
  ASPECT,
  R_MAX,
  fontSize,
  labelWidth,
  panTo,
  panning,
  assignBearings,
  junctionRadius,
  seedPosition,
  settle,
  step,
  targetRadius,
  wander,
  type Pan,
  type WebLink,
  type WebNode,
} from '@/lib/web-layout';
import { thin } from '@/lib/map-layout';
import {
  loadNeighbourhood,
  loadOrganisation,
  type Link,
  type Member,
  type Neighbour,
  type OrgRef,
  type Reason,
} from './actions';

export type Focus = { kind: 'person' | 'org'; id: string };

/**
 * How many names stand around the centre. Sjoerd, 2026-09-13: *"not too many
 * people... maybe a slider... where you can choose: density"*. Eight is a
 * cloud you can read; twenty is a thicket, and some communities want it.
 */
const DENSITY_MIN = 4;
const DENSITY_MAX = 20;
const DENSITY_DEFAULT = 8;
const DENSITY_KEY = 'connections:map-density';

function savedDensity(): number {
  try {
    const n = Number(window.localStorage.getItem(DENSITY_KEY));
    return Number.isFinite(n) && n >= DENSITY_MIN && n <= DENSITY_MAX ? n : DENSITY_DEFAULT;
  } catch {
    return DENSITY_DEFAULT;
  }
}

type Shown = WebNode & {
  kind: 'person' | 'org' | 'junction';
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

type Around = {
  id: string;
  kind: 'person' | 'org' | 'junction';
  label: string;
  sub: string;
  solid: boolean;
  strength: number;
  reasons: Reason[];
  trail?: boolean;
};

/**
 * The names to stand around the centre, at the chosen density.
 *
 * Organisations come first and are never cut below four: they are recorded
 * facts about this person, and dropping "where they work" to fit one more
 * shared tag would be the wrong trade.
 */
function aroundFrom(
  data:
    | { kind: 'person'; neighbours: Neighbour[]; organisations: OrgRef[] }
    | { kind: 'org'; members: Member[] },
  density: number,
  locale: Locale,
): Around[] {
  if (data.kind === 'org') {
    return data.members.slice(0, density).map((m) => ({
      id: m.id,
      kind: 'person' as const,
      label: m.name,
      sub: m.title ?? '',
      // A membership is recorded, so every line to a member is solid.
      solid: true,
      strength: 0.6,
      reasons: [],
    }));
  }
  const max = Math.max(1, ...data.neighbours.map((n) => n.weight));
  const orgs = data.organisations.slice(0, Math.max(1, Math.min(4, density)));
  return [
    ...orgs.map((o) => ({
      id: o.id,
      kind: 'org' as const,
      label: o.name,
      sub: o.title ?? '',
      solid: true,
      strength: 1,
      reasons: [] as Reason[],
    })),
    ...data.neighbours.slice(0, Math.max(1, density - orgs.length)).map((n) => ({
      id: n.id,
      kind: 'person' as const,
      label: n.name,
      sub: n.reasons[0] ? reasonLine(n.reasons[0], locale) : '',
      solid: n.reasons.some((x) => x.kind === 'stated'),
      strength: n.weight / max,
      reasons: n.reasons,
    })),
  ];
}

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
  // The last thing the server said, kept so the density slider can re-cut it
  // without asking again.
  const payload = useRef<
    | { kind: 'person'; neighbours: Neighbour[]; organisations: OrgRef[] }
    | { kind: 'org'; members: Member[] }
    | null
  >(null);
  /** The name you came from, kept visible as the way back. */
  const trailId = useRef<string | null>(null);
  /** Which junction each name hangs from: nothing joins the middle directly. */
  const joinedBy = useRef<Map<string, string>>(new Map());
  const [hoverJunction, setHoverJunction] = useState<string | null>(null);
  /** The direction it must keep: exactly opposite the name that was clicked. */
  const backBearing = useRef<number | null>(null);
  const [density, setDensity] = useState(DENSITY_DEFAULT);
  const densityRef = useRef(DENSITY_DEFAULT);
  densityRef.current = density;
  const placeRef = useRef<((around: Around[]) => void) | null>(null);
  // Read after mount: localStorage does not exist while this renders on the
  // server, and reading it in useState would make the two renders disagree.
  useEffect(() => setDensity(savedDensity()), []);
  const [required, setRequired] = useState<Set<Reason['kind']>>(() => new Set());
  const raf = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  /**
   * A drag in progress. `moved` is what tells a drag from a click: a finger
   * never lands perfectly still, so releasing within a few units still counts
   * as a tap and opens the name.
   */
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  /** Where the pointer is over the cloud, so the middle can lean after it. */
  const pointer = useRef<{ x: number; y: number } | null>(null);

  // ── The animation loop ──────────────────────────────────────────────────
  const animate = useCallback(() => {
    if (raf.current !== null) return;
    if (prefersReducedMotion()) {
      pointer.current = null; // no chasing the mouse if motion is unwelcome
      settle([...nodes.current.values()], 600, webLinks(links.current), pan.current, null);
      setFrame((f) => f + 1);
      return;
    }
    // The loop does not stop. Sjoerd: *"it is always a bit moving... not
    // fixed"*. `step` still comes to rest; `wander` is what keeps the cloud
    // breathing afterwards, and a dragged name needs live frames anyway.
    // requestAnimationFrame pauses itself when the tab is hidden.
    const tick = () => {
      const list = [...nodes.current.values()];
      step(list, webLinks(links.current), pan.current, pointer.current);
      wander(list, performance.now());
      setFrame((f) => f + 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // The mouse leaving is a NATIVE listener, not React's onPointerLeave.
  // React synthesises enter/leave from pointerout/pointerover, which a test
  // dispatching a plain `pointerleave` never triggers — and more to the point,
  // a listener on the element itself is the thing that cannot be missed. If
  // this failed the middle would stay leaning after the mouse had gone.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const gone = () => {
      pointer.current = null;
    };
    svg.addEventListener('pointerleave', gone);
    window.addEventListener('blur', gone);
    return () => {
      svg.removeEventListener('pointerleave', gone);
      window.removeEventListener('blur', gone);
    };
  }, []);

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
    trailId.current = previous?.id ?? null;
    // Hold the way back exactly opposite the name that was clicked. Left to
    // the settling alone it drifts, in the worst case back onto the side you
    // clicked from, which is the one thing this movement exists to show.
    backBearing.current =
      previous && clicked ? Math.atan2(-clicked.y, -clicked.x / ASPECT) : null;
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

    placeRef.current = (around: Around[]) => {
      const centre = map.get(focus.id)!;
      const back = trailId.current ? map.get(trailId.current) : undefined;
      if (back && !around.some((a) => a.id === back.id)) {
        around = [
          ...around,
          {
            id: back.id, kind: back.kind, label: back.label, sub: '',
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
      // Nothing joins the middle directly. Each name hangs off a junction —
      // the topic they have in common — and the junction joins the middle.
      // The grouping comes FIRST, because the slots are handed out by topic:
      // names that share one sit in one wedge of the circle, which is what
      // lets their junction sit in the mouth of that wedge instead of
      // averaging out to somewhere across the cloud.
      const grouped = new Map<string, { label: string; members: Shown[] }>();
      joinedBy.current = new Map();
      for (const n of map.values()) {
        if (n.centre || n.junction) continue;
        const { key, label } = topicOf(n, locale);
        const group = grouped.get(key) ?? { label, members: [] };
        group.members.push(n);
        grouped.set(key, group);
        joinedBy.current.set(n.id, `junction:${key}`);
      }

      const wanted = new Set([...grouped.keys()].map((k) => `junction:${k}`));
      for (const [id, n] of [...map.entries()]) if (n.junction && !wanted.has(id)) map.delete(id);

      const centreNode = map.get(focus.id)!;
      const groups = [...grouped.entries()].map(([key, group]) => {
        const id = `junction:${key}`;
        let junction = map.get(id);
        if (!junction) {
          junction = {
            id,
            x: centreNode.x,
            y: centreNode.y,
            vx: 0,
            vy: 0,
            targetR: 0,
            centre: false,
            junction: true,
            // A junction is a dot: it must not shove names aside.
            width: 10,
            kind: 'junction' as const,
            label: group.label,
            sub: '',
            solid: true,
            strength: 0.5,
            reasons: [],
          };
          map.set(id, junction);
        }
        junction.label = group.label;
        junction.targetR = junctionRadius(group.members.map((m) => m.targetR));
        return { junction, members: group.members };
      });

      assignBearings(
        groups,
        trailId.current && backBearing.current !== null
          ? { id: trailId.current, bearing: backBearing.current }
          : undefined,
      );
      animate();
    };

    const place = placeRef.current;

    void (async () => {
      if (focus.kind === 'person') {
        const r = await loaders.neighbourhood(focus.id);
        if (!alive) return;
        if (!r.ok) return setStatus('failed');
        setAllReasons(new Map(r.neighbours.map((n) => [n.id, n.reasons])));
        links.current = r.links;
        payload.current = { kind: 'person', neighbours: r.neighbours, organisations: r.organisations };
        place(aroundFrom(payload.current, densityRef.current, locale));
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
        payload.current = { kind: 'org', members: r.members };
        place(aroundFrom(payload.current, densityRef.current, locale));
      }
      if (alive) setStatus('ok');
    })();

    return () => {
      alive = false;
    };
    // knownName is read once per focus on purpose; locale only phrases subs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.id, focus.kind]);

  // The slider: re-cut what is already loaded, no second request.
  useEffect(() => {
    if (payload.current && placeRef.current) placeRef.current(aroundFrom(payload.current, density, locale));
    try {
      window.localStorage.setItem(DENSITY_KEY, String(density));
    } catch {
      /* a viewer who blocks storage simply gets the default next time */
    }
  }, [density, locale]);

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
    (n) =>
      n.centre ||
      // Junctions are the topics the lines run through; they are never thinned
      // away by a checkbox, or the lines would run to nothing.
      n.junction ||
      n.trail ||
      n.kind === 'org' ||
      focus.kind === 'org' ||
      visiblePeople.has(n.id),
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
    // A junction is a topic, not a place you can stand: it has no page.
    if (n.junction || n.kind === 'junction') return;
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
          onClick={() => router.push(`${pathname}?view=all`)}
          className="rounded-md px-2 py-1.5 text-ink-muted hover:text-ink"
        >
          {t(locale, 'map_overview')}
        </button>
        <span className="text-xs text-ink-subtle">{t(locale, 'map_web_hint')}</span>
      </div>

      {/* The cloud takes the whole width. Sjoerd: *"Make it wide over the
          screen"* — the controls sit above and below it rather than stealing a
          column, and the container breaks out of the page's reading width. */}
      <div className="mt-4">
        <div className="relative -mx-4 overflow-hidden border-y border-line bg-surface-raised sm:-mx-6 lg:mx-0 lg:rounded-lg lg:border">
          <svg
            ref={svgRef}
            viewBox="-620 -300 1240 600"
            className="block h-auto w-full touch-none select-none"
            role="img"
            aria-label={centreName}
            onPointerMove={(e) => {
              const svg = svgRef.current;
              const ctm = svg?.getScreenCTM();
              if (!svg || !ctm) return;
              const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
              // Every move, dragging or not: the middle leans after the mouse.
              pointer.current = { x: at.x, y: at.y };

              const d = drag.current;
              if (!d) return;
              const node = nodes.current.get(d.id);
              if (!node) return;
              if (Math.hypot(at.x - node.x, at.y - node.y) > DRAG_SLOP) d.moved = true;
              node.x = at.x;
              node.y = at.y;
              node.held = true;
            }}
            onPointerUp={() => {
              const d = drag.current;
              if (!d) return;
              const node = nodes.current.get(d.id);
              if (node) {
                node.held = false;
                // A dropped MIDDLE keeps its place, and the flock spreads
                // around it there. Springing it back to the origin would snap
                // the whole cloud home the moment you let go, which is not
                // dragging — it is tugging something on a piece of elastic.
                if (node.centre && d.moved) {
                  node.homeX = node.x;
                  node.homeY = node.y;
                }
              }
              drag.current = null;
            }}
            onPointerLeave={() => {
              // The mouse has gone; the middle drifts home.
              pointer.current = null;
              const d = drag.current;
              if (d) {
                const node = nodes.current.get(d.id);
                if (node) node.held = false;
              }
              drag.current = null;
            }}
          >
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
            {/* The middle joins each junction, and the junction joins the
                names that share it. Never the middle straight to a name. */}
            {around
              .filter((n) => n.junction)
              .map((j) => (
                <line
                  key={`j-${j.id}`}
                  x1={round(centre?.x ?? 0)}
                  y1={round(centre?.y ?? 0)}
                  x2={round(j.x)}
                  y2={round(j.y)}
                  className="text-ink"
                  stroke="currentColor"
                  strokeOpacity={0.3}
                  strokeWidth={1.4}
                />
              ))}
            {around
              .filter((n) => !n.junction)
              .map((n) => {
                const j = nodes.current.get(joinedBy.current.get(n.id) ?? '');
                const from = j ?? centre;
                return (
                  <line
                    key={`l-${n.id}`}
                    x1={round(from?.x ?? 0)}
                    y1={round(from?.y ?? 0)}
                    x2={round(n.x)}
                    y2={round(n.y)}
                    className="text-ink"
                    stroke="currentColor"
                    strokeOpacity={0.18 + 0.4 * n.strength}
                    strokeWidth={1 + 2 * n.strength}
                    strokeDasharray={n.solid ? undefined : '5 5'}
                  />
                );
              })}
            {/* The junctions themselves: a dot, no label until you hover it.
                The topic is in the shape of the thing, not written on it. */}
            {around
              .filter((n) => n.junction)
              .map((j) => (
                <g
                  key={j.id}
                  transform={`translate(${round(j.x)} ${round(j.y)})`}
                  onMouseEnter={() => setHoverJunction(j.id)}
                  onMouseLeave={() => setHoverJunction((h) => (h === j.id ? null : h))}
                >
                  <circle r={9} fill="transparent" />
                  <circle r={4} className="fill-surface stroke-ink-muted" strokeWidth={1.2} />
                  {hoverJunction === j.id && (
                    <text
                      textAnchor="middle"
                      y={-11}
                      fontSize={12}
                      className="pointer-events-none fill-ink-muted"
                    >
                      {j.label}
                    </text>
                  )}
                  <title>{j.label}</title>
                </g>
              ))}
            {shown
              .filter((n) => !n.junction)
              .map((n) => (
              <g
                key={n.id}
                transform={`translate(${round(n.x)} ${round(n.y)})`}
                className={n.held ? 'cursor-grabbing' : 'cursor-pointer'}
                opacity={n.trail ? 0.55 : 1}
                onPointerDown={(e) => {
                  // Dragging a name shakes the others out of its way, which is
                  // how you uncover one hidden behind another.
                  (e.target as Element).releasePointerCapture?.(e.pointerId);
                  drag.current = { id: n.id, moved: false };
                }}
                onClick={() => {
                  // A drag is not a click. Without this, letting go of a name
                  // you dragged would navigate away from the cloud you were
                  // rearranging.
                  if (drag.current?.moved) return;
                  go(n);
                }}
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
              </g>
            ))}
          </svg>
        </div>

        {/* Density: how many names stand around the centre. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-3">
            <span className="text-xs text-ink-subtle">{t(locale, 'map_density')}</span>
            <input
              type="range"
              min={DENSITY_MIN}
              max={DENSITY_MAX}
              step={1}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="w-40 accent-ink"
              aria-label={t(locale, 'map_density')}
            />
            <span className="w-6 text-xs tabular-nums text-ink-muted">{density}</span>
          </label>
          <span className="text-xs text-ink-subtle">{t(locale, 'map_drag_hint')}</span>
        </div>

        <aside className="mt-4 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
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

/**
 * The topic a name hangs from: its strongest reason, or the way back.
 *
 * The KEY groups people — everyone carrying #retreat shares one junction — and
 * the LABEL is what the junction says when you hover it.
 */
function topicOf(n: Shown, locale: Locale): { key: string; label: string } {
  if (n.trail) return { key: 'back', label: t(locale, 'map_back') };
  if (n.kind === 'org') return { key: `at:${n.id}`, label: n.sub || n.label };
  const r = n.reasons[0];
  if (!r) return { key: 'near', label: t(locale, 'map_near_title') };
  if (r.kind === 'mentioned') return { key: 'mentioned', label: t(locale, 'map_reason_mentioned') };
  return { key: `${r.kind}:${r.label}`, label: reasonLine(r, locale) };
}

function reasonLine(r: Reason, locale: Locale): string {
  if (r.kind === 'tag') return `#${r.label}`;
  if (r.kind === 'mentioned') return t(locale, 'map_reason_mentioned');
  return r.label;
}

const round = (v: number) => Math.round(v * 10) / 10;
/** Below this, a pointer that went down and up again was a click, not a drag. */
const DRAG_SLOP = 6;

/** Only what the simulation needs from a link. */
function webLinks(links: Link[]): WebLink[] {
  return links.map((l) => ({ a: l.a, b: l.b, weight: l.weight }));
}
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
