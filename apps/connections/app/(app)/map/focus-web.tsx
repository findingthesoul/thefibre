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

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { usePersonPopup } from '@/components/person-popup';
import { useOrgPopup } from '@/components/org-popup';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import {
  ASPECT,
  R_MAX,
  fontSize,
  labelWidth,
  panTo,
  panning,
  assignBearings,
  driftBearings,
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
  byDepth,
  depthStyle,
  easeDepth,
  parallax,
  targetDepth,
  type Focus as DepthFocus,
} from '@/lib/web-depth';
import { fetchVocabulary } from '@/app/(app)/people/[id]/actions';
import { onGraphChanged } from '@/lib/graph-changed';
import {
  loadNeighbourhood,
  loadOrganisation,
  loadTag,
  type Link,
  type Member,
  type Neighbour,
  type OrgRef,
  type Reason,
} from './actions';

/**
 * What the cloud is standing on.
 *
 * `tag` is the third kind, added 2026-09-13 — Sjoerd: *"Can you also create a
 * cloud around a location - space... or tag? So you select people around a
 * NODE?"* The map already DREW topics as junctions; this makes one somewhere
 * you can stand rather than only something you can look at.
 */
export type Focus = { kind: 'person' | 'org' | 'tag'; id: string };

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
  /**
   * 0 to 1. New names fade IN where they appear and old ones fade OUT before
   * they go, rather than blinking in and out between one person and the next
   * (Sjoerd, 2026-09-13: "there is a weird jump between one stage and the
   * other... connected items appear and disappear").
   */
  opacity?: number;
  /** On its way out: fading, then dropped. */
  leaving?: boolean;
  kind: 'person' | 'org' | 'junction' | 'tag';
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
  /** On a junction: the tag it stands for, when it stands for one. */
  topicTag?: string;
  /** On a junction: the organisation it stands for, when it stands for one. */
  topicOrg?: string;
  /**
   * Has content: a note, how you know them — or, for a company, always. Drawn
   * full; an empty name is drawn hollow. Sjoerd, 2026-09-14: *"nodes are full
   * (means: have content) or empty (they are unclear or there for overview
   * purposes)"*.
   */
  full?: boolean;
  /** Depth, 0 far to 1 near, eased every frame toward lib/web-depth's target. */
  z?: number;
};

type Around = {
  id: string;
  kind: 'person' | 'org' | 'junction' | 'tag';
  label: string;
  sub: string;
  solid: boolean;
  strength: number;
  reasons: Reason[];
  trail?: boolean;
  full?: boolean;
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
      full: Boolean(m.has_content),
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
      // A company can always be opened, so it is never an empty node.
      full: true,
    })),
    ...data.neighbours.slice(0, Math.max(1, density - orgs.length)).map((n) => ({
      id: n.id,
      kind: 'person' as const,
      label: n.name,
      sub: n.reasons[0] ? reasonLine(n.reasons[0], locale) : '',
      solid: n.reasons.some((x) => x.kind === 'stated'),
      strength: n.weight / max,
      reasons: n.reasons,
      full: Boolean(n.has_content),
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
  `${base}?focus=${f.id}${f.kind === 'person' ? '' : `&kind=${f.kind}`}`;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type Loaders = {
  neighbourhood: typeof loadNeighbourhood;
  organisation: typeof loadOrganisation;
  tag: typeof loadTag;
};
const SERVER: Loaders = {
  neighbourhood: loadNeighbourhood,
  organisation: loadOrganisation,
  tag: loadTag,
};

export function FocusWeb({
  focus,
  knownName,
  locale,
  loaders = SERVER,
  controls,
}: {
  focus: Focus;
  /** The name if the page already knows it, so the centre is labelled at once. */
  knownName: string | null;
  locale: Locale;
  /** The server actions, unless a preview supplies its own data. */
  loaders?: Loaders;
  /** Goes on the row above the cloud, beside the density slider: the page's
   *  own way of choosing who to stand next to. */
  controls?: ReactNode;
}) {
  const router = useRouter();
  // The page this web lives on, so its links stay on it.
  const pathname = usePathname();
  const { openPerson } = usePersonPopup();
  const { openOrg } = useOrgPopup();
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
  /** What the pointer is on — a name or a dot. It comes forward with what it connects to. */
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  /** The direction it must keep: exactly opposite the name that was clicked. */
  const backBearing = useRef<number | null>(null);
  const [density, setDensity] = useState(DENSITY_DEFAULT);
  const densityRef = useRef(DENSITY_DEFAULT);
  densityRef.current = density;
  const placeRef = useRef<((around: Around[]) => void) | null>(null);
  /**
   * Re-read whatever this cloud is standing on, without disturbing it.
   *
   * Kept separate from the focus effect on purpose. Re-running THAT would
   * recompute the pan, clear the trail and re-seed the arrivals — it is the
   * code for "you clicked a name", and a membership being written is not
   * that. This only replaces the facts; the cloud keeps its arrangement and
   * the new name fades in where it belongs.
   */
  const refetchRef = useRef<(() => Promise<void>) | null>(null);
  // Read after mount: localStorage does not exist while this renders on the
  // server, and reading it in useState would make the two renders disagree.
  useEffect(() => setDensity(savedDensity()), []);
  const [required, setRequired] = useState<Set<Reason['kind']>>(() => new Set());
  const raf = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  /** A press in progress, which may or may not become a drag. */
  const drag = useRef<{
    id: string;
    /** Where the pointer went down, in screen pixels. */
    startX: number;
    startY: number;
    /** The name's offset from the pointer when grabbed, so it never snaps. */
    offsetX: number;
    offsetY: number;
    /** Picked up: following the pointer now. */
    held: boolean;
    /** Actually moved. Only this suppresses the click. */
    moved: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  /** Set on releasing a name that really moved, read by the click that follows. */
  const suppressClick = useRef(false);
  /** Where the pointer is over the cloud, so the middle can lean after it. */
  const pointer = useRef<{ x: number; y: number } | null>(null);
  /**
   * Tag name to tag id, so clicking a junction can stand on that topic.
   *
   * The reasons that build a junction carry a tag's NAME and not its id, and
   * this resolves one to the other against the workspace's own tag table —
   * `tag` is unique on (workspace, name), so the lookup is exact and not a
   * guess. That distinction matters here: matching a name in PROSE is the
   * thing handbook §12 forbids, because prose is ambiguous. This is a name
   * that came out of the tag table being looked up in the tag table.
   *
   * Lower-cased on both sides: the name travels through a reason as typed,
   * and a junction that silently refused to open because of a capital letter
   * would look like a bug rather than a rule.
   */
  const [tagIds, setTagIds] = useState<Map<string, string>>(() => new Map());
  /**
   * The cloud filling the screen. Sjoerd, 2026-09-13: *"also add a full
   * screen button"*.
   *
   * A fixed overlay rather than the browser's Fullscreen API, and the choice
   * is deliberate. The native one is refused outright in some embedded
   * contexts, hides the browser's own chrome — and Back is how this map is
   * navigated — and leaves the page in a state this component cannot reliably
   * read back. An overlay always works, keeps every control, and Escape
   * leaves it, which is the gesture people try first anyway.
   */
  const [full, setFull] = useState(false);

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
      // Where each name BELONGS moves first, then the forces pull it there.
      // The other way round and every frame would be a step towards a target
      // that had already moved.
      driftBearings(list, performance.now());
      step(list, webLinks(links.current), pan.current, pointer.current);
      wander(list, performance.now());
      // Fade in what is arriving, fade out what is leaving, and only then let
      // it go. Deleting on the spot is the blink.
      for (const n of list) {
        const want = n.leaving ? 0 : 1;
        const now = n.opacity ?? 1;
        const next = now + (want - now) * FADE;
        n.opacity = Math.abs(want - next) < 0.01 ? want : next;
        if (n.leaving && n.opacity === 0) nodes.current.delete(n.id);
      }
      setFrame((f) => f + 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      if (drag.current?.timer) clearTimeout(drag.current.timer);
    },
    [],
  );

  // Escape leaves full screen, and the page underneath does not scroll while
  // the cloud covers it — a background that scrolls behind an overlay is what
  // makes one feel broken.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [full]);

  // Somebody wrote to the graph — a membership from the organisation popup,
  // today — so the facts on screen are stale. Re-read them in place.
  useEffect(() => onGraphChanged(() => void refetchRef.current?.()), []);

  // The workspace's tags, once, so a junction knows which topic it is. A
  // failure here costs the junction click and nothing else — the cloud is
  // unaffected — so it is swallowed rather than shown.
  useEffect(() => {
    let alive = true;
    void fetchVocabulary()
      .then((v) => {
        if (!alive) return;
        const m = new Map<string, string>();
        for (const w of v.words) if (w.id) m.set(w.name.toLowerCase(), w.id);
        setTagIds(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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
      if (n.centre) n.targetR = 0;
      // Everyone else KEEPS their ring until the new neighbourhood arrives.
      // Flinging them to the outer ring first and pulling them back a moment
      // later is half of the jump between one person and the next.
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
      for (const [id, n] of map) if (!keep.has(id) && !n.junction) n.leaving = true;
      for (const a of around) {
        const existing = map.get(a.id);
        const targetR = targetRadius(a.strength, 1);
        if (existing) {
          Object.assign(existing, {
            trail: false, ...a, targetR, centre: false,
            leaving: false,
            width: labelWidth(a.label, false, a.strength) + MARKER_ROOM,
          });
        } else {
          map.set(a.id, {
            ...a, ...seedPosition(a.id, centre), vx: 0, vy: 0, targetR, centre: false,
            // Arrives invisible, next to whoever brought it in, and fades up.
            opacity: 0,
            width: labelWidth(a.label, false, a.strength) + MARKER_ROOM,
          });
        }
      }
      // Nothing joins the middle directly. Each name hangs off a junction —
      // the topic they have in common — and the junction joins the middle.
      // The grouping comes FIRST, because the slots are handed out by topic:
      // names that share one sit in one wedge of the circle, which is what
      // lets their junction sit in the mouth of that wedge instead of
      // averaging out to somewhere across the cloud.
      const grouped = new Map<string, { label: string; tag?: string; org?: string; members: Shown[] }>();
      const previousJoins = joinedBy.current;
      joinedBy.current = new Map();
      for (const n of map.values()) {
        if (n.centre || n.junction || n.leaving) continue;
        const { key, label, tag, org } = topicOf(n, locale);
        const group = grouped.get(key) ?? { label, ...(tag ? { tag } : {}), ...(org ? { org } : {}), members: [] };
        group.members.push(n);
        grouped.set(key, group);
        joinedBy.current.set(n.id, `junction:${key}`);
      }
      // A name that is leaving keeps the junction it already hung from, so its
      // line fades away with it instead of swinging across to the middle first.
      for (const n of map.values()) {
        if (!n.leaving || n.junction || n.centre) continue;
        const was = previousJoins.get(n.id);
        if (was && map.has(was)) joinedBy.current.set(n.id, was);
      }

      const wanted = new Set([...grouped.keys()].map((k) => `junction:${k}`));
      for (const [id, n] of [...map.entries()]) if (n.junction && !wanted.has(id)) n.leaving = true;

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
            // Arrives invisible and fades up, like the names it holds.
            opacity: 0,
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
        junction.leaving = false;
        junction.label = group.label;
        junction.topicTag = group.tag;
        junction.topicOrg = group.org;
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

    const read = async () => {
      if (focus.kind === 'person') {
        const r = await loaders.neighbourhood(focus.id);
        if (!alive) return;
        if (!r.ok) return setStatus('failed');
        setAllReasons(new Map(r.neighbours.map((n) => [n.id, n.reasons])));
        links.current = r.links;
        payload.current = { kind: 'person', neighbours: r.neighbours, organisations: r.organisations };
        place(aroundFrom(payload.current, densityRef.current, locale));
      } else if (focus.kind === 'tag') {
        // A topic in the middle, its people around it. The same payload shape
        // as an organisation on purpose: `aroundFrom` does not need to know
        // which of the two it is holding, which is what keeps this one
        // component rather than three that drift.
        const r = await loaders.tag(focus.id);
        if (!alive) return;
        if (!r.ok) return setStatus('failed');
        // The hash is how this app writes a tag everywhere else, and it is
        // what tells somebody at a glance that the middle is a word rather
        // than a person with an unusual name.
        const label = `#${r.tag.name}`;
        setCentreName(label);
        const c = map.get(focus.id);
        if (c) {
          c.label = label;
          c.kind = 'tag';
          c.width = labelWidth(label, true);
        }
        setAllReasons(new Map());
        links.current = r.links;
        payload.current = { kind: 'org', members: r.members };
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
    };

    refetchRef.current = read;
    void read();

    return () => {
      alive = false;
      if (refetchRef.current === read) refetchRef.current = null;
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
      // Whoever is on their way out stays on screen until they have faded.
      // Thinning reads the reasons of the person now in the MIDDLE, so the
      // moment the new neighbourhood arrives nobody from the old one is in
      // that list any more — and without this line they were all dropped in
      // a single frame while their replacements faded gently in over a
      // second. That asymmetry was the jump (Sjoerd, 2026-09-13: "there is
      // still a quick jump.... not slow appearing").
      n.leaving ||
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
  // Including the ones on their way out: a line has to fade with the name it
  // touches, or the name's slow departure is upstaged by its lines blinking.
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

  // ── Depth (lib/web-depth.ts) ────────────────────────────────────────────
  //
  // Sjoerd, 2026-09-14: *"the 3D effect can also be more strong. Smaller and
  // bigger. Bringing pieces to the foreground"*. Every node carries a depth
  // that eases toward what it means — the middle nearest, strong and full
  // names nearer than weak and empty ones — and whatever the pointer is on
  // comes forward with everything it is connected to while the rest steps
  // back. Size, light, focus, parallax and paint order all read that one
  // number.
  const related = new Set<string>();
  const hovered = hoverNode ? nodes.current.get(hoverNode) : undefined;
  if (hovered && !hovered.leaving) {
    related.add(hovered.id);
    if (centre) related.add(centre.id);
    if (hovered.junction) {
      for (const [nameId, jid] of joinedBy.current) if (jid === hovered.id) related.add(nameId);
    } else if (hovered.centre) {
      for (const n of shown) if (n.junction) related.add(n.id);
    } else {
      const j = joinedBy.current.get(hovered.id);
      if (j) related.add(j);
      for (const l of links.current) {
        if (l.a === hovered.id) related.add(l.b);
        if (l.b === hovered.id) related.add(l.a);
      }
    }
  }
  const lookingAt = (n: Shown): DepthFocus =>
    !hovered || hovered.leaving ? null : n.id === hovered.id ? 'self' : related.has(n.id) ? 'related' : 'other';
  const still = prefersReducedMotion();
  for (const n of shown) {
    const want = targetDepth(
      { centre: n.centre, junction: n.junction, strength: n.strength, full: n.full, trail: n.trail },
      lookingAt(n),
    );
    n.z = still ? want : easeDepth(n.z, want);
  }
  const lean = still ? null : pointer.current;
  /** Where a node is DRAWN: its place plus a little parallax for its depth. */
  const at = (n: Shown | undefined) => {
    if (!n) return { x: 0, y: 0 };
    const p = parallax(n.z ?? 1, lean);
    return { x: n.x + p.dx, y: n.y + p.dy };
  };
  /** A line between two things you are looking at is lit; others dim with the rest. */
  const lineLit = (a: Shown | undefined, b: Shown | undefined) => {
    if (!hovered) return 1;
    return a && b && related.has(a.id) && related.has(b.id) ? 1.5 : 0.75;
  };
  const junctionFull = (j: Shown) =>
    Boolean(j.topicOrg) || Boolean(j.topicTag && tagIds.has(j.topicTag.toLowerCase()));

  const go = (n: Shown) => {
    if (n.junction || n.kind === 'junction') {
      // A junction IS a topic, and since 2026-09-13 a topic is somewhere you
      // can stand — Sjoerd: *"So you select people around a NODE?"*. Only a
      // tag can be stood on: a junction may also be an organisation (which
      // has its own popup) or the way back, and neither is a word.
      const tagId = n.topicTag ? tagIds.get(n.topicTag.toLowerCase()) : undefined;
      if (tagId) router.push(focusHref({ kind: 'tag', id: tagId }, pathname));
      // A company's dot opens the company — a full node is one you can open.
      else if (n.topicOrg) openOrg(n.topicOrg);
      return;
    }
    if (n.centre) {
      // The same rule for both kinds: the middle opens its details. An
      // organisation's details are its people and a way to add one
      // (Sjoerd, 2026-09-13), which is why clicking a company in the middle
      // is worth something rather than a no-op.
      if (n.kind === 'person') openPerson(n.id);
      else if (n.kind === 'org') openOrg(n.id);
      return;
    }
    router.push(focusHref({ kind: n.kind, id: n.id }, pathname));
  };

  /**
   * Find somebody, and choose how many names stand around them.
   *
   * Finding somebody and choosing how many names to show are the same
   * decision — how much of the community to look at — so they share one row.
   * Sjoerd, 2026-09-13: *"bring the density button above the capture... and
   * instead of a person dropdown I like the entry search field... could we
   * combine that?"*
   *
   * Held as a value because it is drawn in TWO places: above the picture
   * normally, and inside the overlay in full screen. Sjoerd, same day: *"MAPS
   * full screen.. also keep the search and slider..."* — they had been left on
   * the page underneath, which is behind the overlay, so going full screen
   * silently took both away.
   */
  const controlRow = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {controls ? <div className="min-w-0 flex-1 sm:max-w-sm">{controls}</div> : null}
      {/* Sjoerd, 2026-09-13, of the first version: *"This is very hard to
          see... too subtle for older people"*. It was a hairline track and a
          small grey thumb — `accent-ink` alone leaves the TRACK at the
          browser's default, which on a dark ground is nearly invisible.

          Fixed by drawing both explicitly rather than by nudging a colour: a
          real track with a border, a 20px thumb with a ring around it, and a
          label that is `text-ink` instead of the subtlest grey in the palette.
          20px also clears the target a finger needs, so this is legibility and
          reach in one change.

          The two vendor prefixes are both required and are not
          interchangeable — WebKit and Firefox style the thumb under different
          selector names, and a rule naming one silently does nothing in the
          other. */}
      <label className="flex shrink-0 items-center gap-3">
        <span className="text-xs font-medium text-ink">{t(locale, 'map_density')}</span>
        <input
          type="range"
          min={DENSITY_MIN}
          max={DENSITY_MAX}
          step={1}
          value={density}
          onChange={(e) => setDensity(Number(e.target.value))}
          aria-label={t(locale, 'map_density')}
          aria-valuetext={String(density)}
          className="h-5 w-44 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface-sunken
            [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-ink
            [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-ink"
        />
        <span className="w-6 text-sm font-medium tabular-nums text-ink">{density}</span>
      </label>
    </div>
  );

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
        <button
          type="button"
          onClick={() => setFull((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-ink-muted hover:text-ink"
          aria-pressed={full}
        >
          {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {t(locale, full ? 'map_exit_full' : 'map_full')}
        </button>
        <span className="text-xs text-ink-subtle">{t(locale, 'map_web_hint')}</span>
      </div>
      {/* Not while full screen: the overlay draws its own copy, and two
          sliders on screen disagreeing about which one is live is worse than
          one that moves. */}
      {!full && <div className="mt-4">{controlRow}</div>}

      {/* The cloud takes the whole width. Sjoerd: *"Make it wide over the
          screen"* — the container breaks out of the page's reading width. */}
      <div className="mt-3">
        <div
          className={
            full
              ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-raised'
              : 'relative -mx-4 overflow-hidden border-y border-line bg-surface-raised sm:-mx-6 lg:mx-0 lg:rounded-lg lg:border'
          }
        >
          {/* In full screen the controls and the way out come WITH the cloud.
              Leaving them on the page underneath puts them behind the
              overlay, which is what took the search and the slider away. */}
          {full && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">{controlRow}</div>
              <button
                type="button"
                onClick={() => setFull(false)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-sunken"
              >
                <Minimize2 size={14} /> {t(locale, 'map_exit_full')}
              </button>
            </div>
          )}
          <svg
            ref={svgRef}
            viewBox="-620 -300 1240 600"
            /* Full screen fills the height too. The drawing keeps its own
               proportions (the default preserveAspectRatio), so a tall screen
               gets margins rather than a stretched cloud. */
            className={`block touch-none select-none ${full ? 'min-h-0 flex-1 w-full' : 'h-auto w-full'}`}
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
              // Measured from where the press began, in screen pixels.
              if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_SLOP_PX) {
                d.moved = true;
                d.held = true;
              }
              if (!d.held) return;
              // The grab offset is what stops the name jumping to sit under the
              // cursor the moment you twitch.
              node.x = at.x + d.offsetX;
              node.y = at.y + d.offsetY;
              node.held = true;
            }}
            onPointerUp={() => {
              const d = drag.current;
              if (!d) return;
              if (d.timer) clearTimeout(d.timer);
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
              // Only a name that really moved swallows the click that follows.
              // A press that merely lasted a while is still a click.
              suppressClick.current = d.moved;
              drag.current = null;
            }}
            onPointerLeave={() => {
              // The mouse has gone; the middle drifts home.
              pointer.current = null;
              const d = drag.current;
              if (d) {
                if (d.timer) clearTimeout(d.timer);
                const node = nodes.current.get(d.id);
                if (node) node.held = false;
              }
              drag.current = null;
            }}
          >
            {/* Soft focus for what is far away (lib/web-depth.ts). Three
                steps, not one per node: a filter per name would be one filter
                per frame per name. */}
            <defs>
              {BLUR_STEPS.map((sd, i) => (
                <filter key={sd} id={`web-far-${i}`} x="-20%" y="-50%" width="140%" height="200%">
                  <feGaussianBlur stdDeviation={sd} />
                </filter>
              ))}
            </defs>
            {/* Between the people around the centre. Drawn first and faintest:
                they are the shape of the group, not the answer to "who is near
                this person", which is the star below. A shared tag is dashed —
                sharing a word is not knowing someone (handbook §12). Lines to
                what you point at come forward with it. */}
            {crossLines.map((l) => {
              const a = at(l.a);
              const b = at(l.b);
              const lit = lineLit(l.a, l.b);
              return (
                <line
                  key={`x-${l.a.id}-${l.b.id}`}
                  x1={round(a.x)}
                  y1={round(a.y)}
                  x2={round(b.x)}
                  y2={round(b.y)}
                  className="text-ink"
                  stroke="currentColor"
                  strokeOpacity={Math.min(
                    1,
                    (0.1 + 0.18 * Math.min(1, l.weight)) * Math.min(l.a.opacity ?? 1, l.b.opacity ?? 1) * lit,
                  )}
                  strokeWidth={(0.8 + 1.2 * Math.min(1, l.weight)) * (lit > 1 ? 1.2 : 1)}
                  strokeDasharray={l.solid ? undefined : DOTTED}
                  strokeLinecap={l.solid ? undefined : 'round'}
                >
                  <title>{l.why}</title>
                </line>
              );
            })}
            {/* The middle joins each junction, and the junction joins the
                names that share it. Never the middle straight to a name. */}
            {around
              .filter((n) => n.junction)
              .map((j) => {
                const c = at(centre);
                const q = at(j);
                const lit = lineLit(centre, j);
                return (
                  <line
                    key={`j-${j.id}`}
                    x1={round(c.x)}
                    y1={round(c.y)}
                    x2={round(q.x)}
                    y2={round(q.y)}
                    className="text-ink"
                    stroke="currentColor"
                    strokeOpacity={Math.min(1, 0.3 * (j.opacity ?? 1) * lit)}
                    strokeWidth={lit > 1 ? 1.7 : 1.4}
                  />
                );
              })}
            {around
              .filter((n) => !n.junction)
              .map((n) => {
                const j = nodes.current.get(joinedBy.current.get(n.id) ?? '');
                const from = j ?? centre;
                const f = at(from);
                const q = at(n);
                const lit = lineLit(from, n);
                return (
                  <line
                    key={`l-${n.id}`}
                    x1={round(f.x)}
                    y1={round(f.y)}
                    x2={round(q.x)}
                    y2={round(q.y)}
                    className="text-ink"
                    stroke="currentColor"
                    strokeOpacity={Math.min(
                      1,
                      (0.18 + 0.4 * n.strength) * Math.min(n.opacity ?? 1, from?.opacity ?? 1) * lit,
                    )}
                    strokeWidth={(1 + 2 * n.strength) * (lit > 1 ? 1.15 : 1)}
                    strokeDasharray={n.solid ? undefined : DOTTED}
                    strokeLinecap={n.solid ? undefined : 'round'}
                  />
                );
              })}
            {/* The junctions: what connects people. FULL when it is a real
                thing you can open — a tag you can stand on, a company — drawn
                solid and named. EMPTY when it only groups (the way back, named
                in the same note): a small hollow ring, named on hover.
                Sjoerd, 2026-09-14: *"this nodes, should be more useful. Like
                see the connections"*. */}
            {byDepth(
              around.filter((n) => n.junction),
              (n) => n.z ?? 0.55,
            ).map((j) => {
              const q = at(j);
              const st = depthStyle(j.z ?? 0.55);
              const jFull = junctionFull(j);
              return (
                <g
                  key={j.id}
                  data-junction={jFull ? 'full' : 'empty'}
                  opacity={(j.opacity ?? 1) * st.opacity}
                  transform={`translate(${round(q.x)} ${round(q.y)}) scale(${round3(st.scale)})`}
                  className={jFull ? 'cursor-pointer' : undefined}
                  onMouseEnter={() => setHoverNode(j.id)}
                  onMouseLeave={() => setHoverNode((h) => (h === j.id ? null : h))}
                  onClick={() => go(j)}
                >
                  <circle r={11} fill="transparent" />
                  {jFull ? (
                    <circle r={4.5} className="fill-ink-muted stroke-surface-raised" strokeWidth={1.2} />
                  ) : (
                    <circle r={3.5} className="fill-surface-raised stroke-ink-muted" strokeWidth={1.2} />
                  )}
                  {jFull && hoverNode !== j.id && (
                    <text y={-10} textAnchor="middle" fontSize={10.5} className="pointer-events-none fill-ink-muted">
                      {truncate(j.label, 24)}
                    </text>
                  )}
                  <title>{j.label}</title>
                </g>
              );
            })}
            {/* The names, far first so near ones are painted over them. */}
            {byDepth(
              shown.filter((n) => !n.junction),
              (n) => n.z ?? 1,
            ).map((n) => {
              const q = at(n);
              const st = depthStyle(n.z ?? 1, n.centre);
              const blurStep = st.blur ? Math.min(BLUR_STEPS.length - 1, Math.floor(st.blur / 0.15)) : -1;
              const marker = !n.centre && n.kind === 'person';
              return (
                <g
                  key={n.id}
                  transform={`translate(${round(q.x)} ${round(q.y)}) scale(${round3(st.scale)})`}
                  className={n.held ? 'cursor-grabbing' : 'cursor-pointer'}
                  opacity={(n.opacity ?? 1) * (n.trail ? 0.55 : 1) * st.opacity}
                  filter={blurStep >= 0 ? `url(#web-far-${blurStep})` : undefined}
                  data-full={marker ? String(Boolean(n.full)) : undefined}
                  onMouseEnter={() => setHoverNode(n.id)}
                  onMouseLeave={() => setHoverNode((h) => (h === n.id ? null : h))}
                  onPointerDown={(e) => {
                    // Dragging a name shakes the others out of its way, which is
                    // how you uncover one hidden behind another.
                    (e.target as Element).releasePointerCapture?.(e.pointerId);
                    const svg = svgRef.current;
                    const ctm = svg?.getScreenCTM();
                    const pt = ctm
                      ? new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
                      : null;
                    if (drag.current?.timer) clearTimeout(drag.current.timer);
                    const d = {
                      id: n.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      offsetX: pt ? n.x - pt.x : 0,
                      offsetY: pt ? n.y - pt.y : 0,
                      held: false,
                      moved: false,
                      timer: null as ReturnType<typeof setTimeout> | null,
                    };
                    // Hold still and you still pick it up. Without this a drag
                    // could only ever start with a flick.
                    d.timer = setTimeout(() => {
                      if (drag.current === d) d.held = true;
                    }, HOLD_MS);
                    drag.current = d;
                  }}
                  onClick={() => {
                    // A drag is not a click. Without this, letting go of a name
                    // you dragged navigates away from the cloud you were just
                    // rearranging — and the guard has to live outside `drag`,
                    // which pointerup has already cleared by the time this runs.
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
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
                  {/* Full or empty: a filled dot when something is written on
                      this person, a hollow one when they are only here for the
                      overview. */}
                  {marker && (
                    <circle
                      cx={-n.width / 2 + 11}
                      cy={n.sub ? -4 : 0}
                      r={3}
                      className={n.full ? 'fill-ink-muted' : 'fill-transparent stroke-ink-subtle'}
                      strokeWidth={n.full ? 0 : 1.2}
                    />
                  )}
                  {/* Bigger name, stronger connection (Sjoerd: "Some words are
                      bigger and some are smaller"). */}
                  <text
                    textAnchor="middle"
                    x={marker ? MARKER_ROOM / 2 : 0}
                    y={n.centre ? 7 : n.sub ? 1 : 5}
                    fontSize={fontSize(n.strength, n.centre)}
                    className={`${marker && !n.full ? 'fill-ink-muted' : 'fill-ink'} ${
                      n.centre ? 'font-semibold' : 'font-medium hover:underline'
                    }`}
                  >
                    {n.label || '…'}
                  </text>
                </g>
              );
            })}
            {/* The hovered dot's name, painted last so it is on top of
                everything. Sjoerd, 2026-09-13: *"nodes behind a name, the
                hover shows behind it"*. */}
            {(() => {
              const j = hoverNode ? nodes.current.get(hoverNode) : null;
              if (!j || !j.junction || j.leaving) return null;
              const q = at(j);
              const w = j.label.length * 6.4 + 14;
              return (
                <g
                  transform={`translate(${round(q.x)} ${round(q.y)})`}
                  className="pointer-events-none"
                  opacity={j.opacity ?? 1}
                >
                  <rect
                    x={-w / 2}
                    y={-30}
                    width={w}
                    height={19}
                    rx={9}
                    className="fill-surface stroke-line"
                    strokeWidth={1}
                  />
                  <text textAnchor="middle" y={-16} fontSize={12} className="fill-ink-muted">
                    {j.label}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        <p className="mt-3 text-xs text-ink-subtle">{t(locale, 'map_drag_hint')}</p>

        <aside className="mt-4 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
          {status === 'loading' && <p className="text-xs text-ink-muted">{t(locale, 'loading')}</p>}
          {status === 'failed' && <p className="text-xs text-ink">{t(locale, 'map_near_failed')}</p>}
          {status === 'ok' && around.length === 0 && (
            <p className="text-xs text-ink-muted">
              {focus.kind === 'tag'
                ? t(locale, 'map_tag_empty')
                : focus.kind === 'org'
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
function topicOf(n: Shown, locale: Locale): { key: string; label: string; tag?: string; org?: string } {
  if (n.trail) return { key: 'back', label: t(locale, 'map_back') };
  if (n.kind === 'org') return { key: `at:${n.id}`, label: n.sub || n.label, org: n.id };
  const r = n.reasons[0];
  if (!r) return { key: 'near', label: t(locale, 'map_near_title') };
  if (r.kind === 'mentioned') return { key: 'mentioned', label: t(locale, 'map_reason_mentioned') };
  // `tag` is the only topic you can stand on, so it is the only one whose
  // name is carried through. A junction without one is not clickable, which
  // is the honest behaviour for "the way back" or "named in the same note".
  return {
    key: `${r.kind}:${r.label}`,
    label: reasonLine(r, locale),
    ...(r.kind === 'tag' ? { tag: r.label } : {}),
  };
}

function reasonLine(r: Reason, locale: Locale): string {
  if (r.kind === 'tag') return `#${r.label}`;
  if (r.kind === 'mentioned') return t(locale, 'map_reason_mentioned');
  return r.label;
}

const round = (v: number) => Math.round(v * 10) / 10;

// ── Telling a click from a drag ────────────────────────────────────────────
//
// Sjoerd, 2026-09-13: *"now we need to clarify click and dragging... maybe
// timing?"* Both, in the end, and they answer two different questions.
//
//   PICKED UP?   You moved more than SLOP, or you held still for HOLD_MS.
//                The hold is what lets you pick a name up without flinging it,
//                and it is what makes this work under a finger.
//   A CLICK?     Only if the name never actually MOVED. A slow, deliberate
//                click is still a click: it may pass the hold and pick the
//                name up, but putting it back where it was is not a drag.
//
// SLOP is in SCREEN PIXELS, not in the drawing's own units. The cloud is drawn
// 1240 units wide into whatever width the screen gives it, so a threshold in
// drawing units means something different on every monitor — and the old one
// worked out at under four real pixels, tight enough that a steady hand could
// still miss.
/** How far the pointer may wander, in screen pixels, and still be a click. */
const DRAG_SLOP_PX = 5;
/** How quickly a name fades in or out. About 0.8s, which reads as gradual;
 *  at twice that speed it still looked like an appearance rather than a fade. */
const FADE = 0.05;
/** Hold this long without moving and the name is picked up anyway. */
const HOLD_MS = 180;
/** Room beside a person's name for the full/empty marker. */
const MARKER_ROOM = 12;
/** Soft-focus steps for far names, in SVG blur units. */
const BLUR_STEPS = [0.15, 0.3];
/**
 * A tie that is NOT a stated relationship (a shared tag, a workspace word) is
 * dotted: round dots, gaps a little wider than the line. Sjoerd, 2026-09-15:
 * *"You use dashed lines... maybe better to use dotted lines"* — dashes read as
 * a technical diagram, dots as a softer, looser tie.
 */
const DOTTED = '0.1 4.5';
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Only what the simulation needs from a link. */
function webLinks(links: Link[]): WebLink[] {
  return links.map((l) => ({ a: l.a, b: l.b, weight: l.weight }));
}
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
