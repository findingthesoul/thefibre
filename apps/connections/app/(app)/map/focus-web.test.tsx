// @vitest-environment jsdom
//
// Switching from one person to the next is a CROSSFADE, both ways.
//
// Sjoerd asked for this three times, and the first two answers each fixed half
// of it (2026-09-13): *"when clicking on another person there is a weird jump
// between one stage and the other"*, then *"when connections appear there is
// this weird sudden jump, not a gradual appearing"*, then — after the names
// and the lines had both been given a fade — *"there is still a quick jump....
// not slow appearing"*.
//
// The half that was still missing was the OUT direction, and it was invisible
// in the code that fades: the arithmetic ran perfectly on nodes that had
// already been filtered out of the picture. `shown` keeps a name if the
// thinning controls say the person now in the MIDDLE has a reason to show
// them — and the instant a new neighbourhood arrives, nobody from the old one
// is in that list. So the departing half of the cloud was dropped in a single
// frame while its replacement faded gently in over a second, which reads as a
// jump no matter how slow the half you can see is.
//
// What these tests pin, and what they do NOT:
//
// Mutation-checked, one fix at a time — three separate runs:
//
//   - `n.leaving ||` removed from the `shown` filter: the first two tests
//     fail. The departing names are simply not in the DOM.
//   - the departing names' LINES not drawn: the third test fails.
//   - the departing JUNCTIONS' lines not drawn: the third test fails too.
//
// The third test counts lines against names AND junctions together. An
// earlier version counted only lines, and passed with the departing names'
// lines removed, because the junction lines happened to make up the number.
// That is the failure mode this file is most exposed to, so it is written
// down rather than left to be rediscovered.
//
// These say nothing about the SPEED of the fade. That is FADE, a number, and
// a test asserting it would only restate it.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({
  loadNeighbourhood: async () => ({ ok: false }),
  loadOrganisation: async () => ({ ok: false }),
  loadTag: async () => ({ ok: false }),
}));
// The tag lookup behind a junction click. Not exercised by these tests, but
// the module is imported at load, so it needs an answer.
vi.mock('@/app/(app)/people/[id]/actions', () => ({
  fetchVocabulary: async () => ({ words: [], people: [] }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, back: () => {} }),
  usePathname: () => '/map',
}));

import { FocusWeb } from './focus-web';

/** The animation frames, pumped by hand: jsdom has no compositor. */
let frames: FrameRequestCallback[] = [];
let container: HTMLDivElement;
let root: Root;
let clock = 0;

// BEA stands in ANN's cloud, so moving to her is a CLICK on a name that is
// already there — which is the movement this file is about. Jumping to a
// stranger (a pasted URL) is a different thing and deliberately clears the
// cloud instead of crossfading it.
const NEIGHBOURS: Record<string, string[]> = {
  ann: ['bea', 'cal', 'dov'],
  bea: ['eef', 'fia', 'gus'],
};

const loaders = {
  neighbourhood: async (id: string) => ({
    ok: true as const,
    neighbours: (NEIGHBOURS[id] ?? []).map((n, i) => ({
      id: n,
      name: n.toUpperCase(),
      weight: 3 - i,
      reasons: [{ kind: 'tag' as const, label: id === 'ann' ? 'athens' : 'retreat' }],
    })),
    organisations: [],
    links: [],
  }),
  organisation: async () => ({
    ok: true as const,
    organisation: { id: 'o', name: 'ORG' },
    members: [],
    links: [],
  }),
} as unknown as Parameters<typeof FocusWeb>[0]['loaders'];

/** Run n animation frames. */
async function run(n: number) {
  for (let i = 0; i < n; i++) {
    const due = frames;
    frames = [];
    clock += 16;
    await act(async () => {
      for (const cb of due) cb(clock);
    });
  }
}

/**
 * The map's own drawing.
 *
 * Scoped, and it has to be: this file first counted every `<line>` in the
 * container, and the moment a lucide icon appeared in the controls above the
 * cloud the count jumped by two — an icon is an SVG made of lines. The test
 * failed for a reason with nothing to do with the map, which is the worst
 * kind of failing test.
 */
const cloud = () => container.querySelector('svg[role="img"]')!;

/** Every name on screen, with the opacity it is drawn at. */
function namesOnScreen(): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of cloud().querySelectorAll('g[role="button"]')) {
    out.set(g.getAttribute('aria-label') ?? '', Number(g.getAttribute('opacity') ?? '1'));
  }
  return out;
}

beforeEach(() => {
  frames = [];
  clock = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/**
 * Render this person and let the cloud settle.
 *
 * `frames` is how many animation frames to run afterwards — 0 for the moment
 * the new neighbourhood lands, which is what a crossfade has to be watched
 * from. (It defaulted to a settled 120 at first, and the fade was long over
 * before anything was measured: the tests said the old names were gone when
 * what they meant was "gone by now".)
 */
async function show(focusId: string, frames = 120) {
  await act(async () => {
    root.render(<FocusWeb focus={{ kind: 'person', id: focusId }} knownName={focusId.toUpperCase()} locale="en" loaders={loaders} />);
  });
  // The neighbourhood arrives on a microtask.
  await act(async () => {});
  await run(frames);
}

describe('moving from one person to the next', () => {
  it('keeps the people you are leaving on screen, fading, while the new ones fade in', async () => {
    await show('ann');
    expect([...namesOnScreen().keys()]).toEqual(expect.arrayContaining(['BEA', 'CAL', 'DOV']));

    await show('bea', 6); // a tenth of a second into the switch

    const now = namesOnScreen();
    // The people we came from are still drawn, and part-way faded — not gone,
    // and not at full strength either.
    for (const gone of ['CAL', 'DOV']) {
      const o = now.get(gone);
      expect(o, `${gone} should still be on screen`).toBeDefined();
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThan(1);
    }
    // ... at the same time as the new ones are arriving, also part-way.
    for (const fresh of ['EEF', 'FIA', 'GUS']) {
      const o = now.get(fresh);
      expect(o, `${fresh} should be arriving`).toBeDefined();
      expect(o).toBeLessThan(1);
      expect(o).toBeGreaterThan(0);
    }
  });

  it('fades the departing people OUT while the arriving ones fade IN, never both one way', async () => {
    await show('ann');
    await show('bea', 4);
    const early = namesOnScreen();
    await run(14);
    const later = namesOnScreen();

    // Every name we are leaving is fainter than it was; every new one is
    // stronger. A snapshot at one moment cannot tell a fade from a constant.
    for (const gone of ['CAL', 'DOV']) {
      expect(later.get(gone) ?? 0, `${gone} fading out`).toBeLessThan(early.get(gone)!);
    }
    for (const fresh of ['EEF', 'FIA', 'GUS']) {
      expect(later.get(fresh)!, `${fresh} fading in`).toBeGreaterThan(early.get(fresh)!);
    }
  });

  it('draws the lines of the people who are leaving, so a line never blinks out from under a name', async () => {
    await show('ann');
    await show('bea', 6);

    // The invariant, and the whole of what "never blinks out from under a
    // name" means: every name on screen except the one in the middle hangs
    // from a line. Counting lines alone would pass while the departing names
    // hung from nothing, because the junction lines make up the number.
    const lines = [...cloud().querySelectorAll('line')];
    const names = namesOnScreen();
    // Every junction is a dot, and every dot is joined to the middle.
    const junctions = cloud().querySelectorAll('circle[r="4"]').length;
    expect(names.size, 'both sets are on screen at once').toBeGreaterThan(4);
    // One line per name that is not the centre, plus one per junction. The
    // count alone is what an earlier version of this test checked, and it
    // passed with the departing names' lines removed — the junction lines
    // made up the number. Counting BOTH is what pins it.
    expect(lines.length, 'a line for every name but the centre, and one per junction').toBe(
      names.size - 1 + junctions,
    );
    // ... and those lines are mid-fade, not drawn at their settled strength.
    const faint = lines.filter((l) => {
      const o = Number(l.getAttribute('stroke-opacity') ?? '1');
      return o > 0 && o < 0.35;
    });
    expect(faint.length, 'some lines are part-way through a fade').toBeGreaterThan(0);
  });
});
