import { describe, expect, it } from 'vitest';
import {
  GLIDE_FRAMES,
  R_MAX,
  R_MIN,
  easeInOut,
  fontSize,
  labelWidth,
  panTo,
  seedPosition,
  settle,
  step,
  targetRadius,
  type WebNode,
} from './web-layout';

const node = (id: string, targetR: number, centre = false, at = { x: 0, y: 0 }): WebNode => ({
  id,
  ...at,
  vx: 0,
  vy: 0,
  targetR,
  width: labelWidth(id, centre),
  centre,
});

function web(weights: Record<string, number>, from = { x: 0, y: 0 }) {
  const max = Math.max(...Object.values(weights));
  return [
    node('Wilma Doornbos', 0, true, { x: 180, y: -40 }), // just clicked: starts off-centre
    ...Object.entries(weights).map(([id, w]) => node(id, targetRadius(w, max), false, seedPosition(id, from))),
  ];
}

const dist = (n: WebNode) => Math.hypot(n.x, n.y);

describe('the moving web', () => {
  it('brings the person you clicked to the centre', () => {
    const nodes = web({ Joost: 3, Aniek: 1 });
    settle(nodes);
    expect(dist(nodes[0]!)).toBeLessThan(2);
  });

  it('comes to rest instead of orbiting', () => {
    const nodes = web({ Joost: 3, Aniek: 2, Marja: 1, Daniel: 1, Femke: 2 });
    expect(settle(nodes)).toBeLessThan(0.01);
  });

  it('puts the most valuable connection closest', () => {
    const nodes = web({ strongest: 5, weakest: 1 });
    settle(nodes);
    const by = Object.fromEntries(nodes.map((n) => [n.id, dist(n)]));
    expect(by.strongest!).toBeLessThan(by.weakest!);
  });

  it('keeps names from sitting on top of each other', () => {
    // Twelve neighbours of equal weight all want the same ring.
    const weights = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`Person number ${i}`, 1]));
    const nodes = web(weights);
    settle(nodes, 1500);
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const clearX = Math.abs(a.x - b.x) >= (a.width + b.width) / 2 - 6;
        const clearY = Math.abs(a.y - b.y) >= 34 - 6;
        expect(clearX || clearY, `${a.id} / ${b.id}`).toBe(true);
      }
    }
  });

  it('spreads connections round the whole circle, not one side', () => {
    const nodes = web({ Joost: 3, Aniek: 2.7, Marja: 2.4, Daniel: 2.1, Femke: 1.8, Pieter: 1.5, Lotte: 1.2, Sanne: 1, Ruben: 0.8 });
    settle(nodes, 1500);
    const angles = nodes
      .filter((n) => !n.centre)
      .map((n) => Math.atan2(n.y - nodes[0]!.y, n.x - nodes[0]!.x))
      .sort((x, y) => x - y);
    const gaps = angles.map((a, i) => (i === 0 ? a + Math.PI * 2 - angles[angles.length - 1]! : a - angles[i - 1]!));
    // Nine names: an even spread leaves 40 degrees between neighbours. A gap
    // of more than 120 is a visibly empty side.
    expect(Math.max(...gaps) * (180 / Math.PI)).toBeLessThan(120);
  });

  it('builds the same web the same way twice', () => {
    const a = web({ Joost: 3, Aniek: 1 });
    const b = web({ Joost: 3, Aniek: 1 });
    settle(a);
    settle(b);
    expect(a.map((n) => [n.x, n.y])).toEqual(b.map((n) => [n.x, n.y]));
  });
});

describe('rings', () => {
  it('gives the strongest the inner ring and nothing the outer one', () => {
    expect(targetRadius(5, 5)).toBe(R_MIN);
    expect(targetRadius(0, 5)).toBe(R_MAX);
  });
});

describe('the glide: clicking moves the whole cloud', () => {
  /** Settle a web, then click one of its names, exactly as the component does. */
  function clickOn(weights: Record<string, number>, target: string) {
    const nodes = web(weights);
    settle(nodes);
    const clicked = nodes.find((n) => n.id === target)!;
    const oldCentre = nodes[0]!;
    const came = { x: clicked.x, y: clicked.y };
    const pan = panTo(clicked);
    // Rings stay by strength, and the name you came FROM becomes the trail
    // node on the outer ring — both as the component does. An earlier version
    // of this test put every name on one ring, which crowds them far harder
    // than the app ever does and made the result look worse than it is.
    const max = Math.max(...Object.values(weights));
    for (const n of nodes) {
      n.centre = n.id === target;
      if (n.centre) n.targetR = 0;
      else if (n === oldCentre) n.targetR = targetRadius(0, 1);
      else n.targetR = targetRadius(weights[n.id] ?? 1, max);
    }
    settle(nodes, 1500, [], pan);
    let diff = Math.abs(Math.atan2(oldCentre.y, oldCentre.x) - Math.atan2(came.y, came.x));
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return { clicked, oppositeBy: diff * (180 / Math.PI) };
  }

  const SETS: Record<string, number>[] = [
    { Joost: 3, Aniek: 2, Marja: 1 },
    { Joost: 3, Aniek: 2.5, Marja: 2, Daniel: 1.5, Femke: 1 },
    { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1 },
  ];
  const allAngles = () =>
    SETS.flatMap((weights) => Object.keys(weights).map((target) => clickOn(weights, target).oppositeBy));

  it('brings the clicked name to the middle', () => {
    const { clicked } = clickOn(SETS[0]!, 'Joost');
    expect(Math.hypot(clicked.x, clicked.y)).toBeLessThan(3);
  });

  it('never leaves the name you came from on the side you clicked', () => {
    // The floor, across sixteen cases. Measured worst case is about 105
    // degrees, in the hardest one: eight equally-weighted names competing for
    // a single ring.
    for (const a of allAngles()) expect(a).toBeGreaterThan(95);
  });

  it('usually puts it clearly opposite, not merely off to one side', () => {
    // The typical case is what you actually see: the median sits near 148.
    const sorted = allAngles().sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    expect(median).toBeGreaterThan(135);
  });
});

describe('links between the people around you', () => {
  const near = (nodes: WebNode[], a: string, b: string) => {
    const x = nodes.find((n) => n.id === a)!;
    const y = nodes.find((n) => n.id === b)!;
    return Math.hypot(x.x - y.x, x.y - y.y);
  };

  it('draws two connected people closer than two unconnected ones', () => {
    const weights = { Joost: 1, Aniek: 1, Marja: 1, Daniel: 1 };
    const linked = web(weights);
    settle(linked, 1500, [{ a: 'Joost', b: 'Aniek', weight: 1 }]);
    const loose = web(weights);
    settle(loose, 1500);
    expect(near(linked, 'Joost', 'Aniek')).toBeLessThan(near(loose, 'Joost', 'Aniek'));
  });

  it('still comes to rest with links pulling', () => {
    const nodes = web({ Joost: 3, Aniek: 2, Marja: 1, Daniel: 1 });
    const links = [
      { a: 'Joost', b: 'Aniek', weight: 1 },
      { a: 'Aniek', b: 'Marja', weight: 0.5 },
      { a: 'Marja', b: 'Daniel', weight: 0.8 },
    ];
    expect(settle(nodes, 2000, links)).toBeLessThan(0.01);
  });

  it('never drags a strong connection further out than a weak one', () => {
    // The ring must keep meaning what it says: distance from the middle is
    // the strength of the connection, and a link may not overrule it.
    const nodes = web({ strongest: 5, weakest: 1 });
    settle(nodes, 2000, [{ a: 'strongest', b: 'weakest', weight: 1 }]);
    const d = Object.fromEntries(nodes.filter((n) => !n.centre).map((n) => [n.id, Math.hypot(n.x, n.y)]));
    expect(d.strongest!).toBeLessThan(d.weakest!);
  });
});

describe('name size', () => {
  it('makes a stronger connection bigger, and the centre biggest', () => {
    expect(fontSize(1, false)).toBeGreaterThan(fontSize(0, false));
    expect(fontSize(1, true)).toBeGreaterThan(fontSize(1, false));
  });

  it('keeps every name readable, however weak', () => {
    expect(fontSize(0, false)).toBeGreaterThan(10);
  });
});

describe('the glide eases in and out', () => {
  /** How far the cloud is carried on each frame of a glide. */
  function framePace() {
    const nodes = web({ Joost: 1 });
    settle(nodes);
    const mover = nodes[1]!;
    const pan = panTo({ x: 300, y: 0 });
    const pace: number[] = [];
    for (let i = 0; i < GLIDE_FRAMES; i += 1) {
      const before = mover.x;
      step(nodes, [], pan);
      pace.push(Math.abs(mover.x - before));
    }
    return pace;
  }

  it('starts gently, is quickest in the middle, and arrives gently', () => {
    const pace = framePace();
    const first = pace[0]!;
    const middle = pace[Math.floor(GLIDE_FRAMES / 2)]!;
    const last = pace[GLIDE_FRAMES - 1]!;
    // Spending a fixed fraction of what remains — the obvious implementation —
    // makes the FIRST frame the fastest. That reads as a lurch, and is what
    // this test exists to keep out.
    expect(middle).toBeGreaterThan(first * 3);
    expect(middle).toBeGreaterThan(last * 3);
  });

  it('spends the whole translation, exactly once', () => {
    // Measured on the pan itself rather than on a node: a node also feels its
    // springs, so its travel is the glide PLUS the settling, and asserting on
    // its position would be testing two things at once.
    const nodes = web({ Joost: 1 });
    const pan = panTo({ x: 120, y: -80 });
    for (let i = 0; i < GLIDE_FRAMES; i += 1) step(nodes, [], pan);
    expect(pan.done).toBeCloseTo(1, 6);
    expect(pan.t).toBe(GLIDE_FRAMES);
    // And it stops: further frames spend nothing.
    step(nodes, [], pan);
    expect(pan.t).toBe(GLIDE_FRAMES);
  });

  it('is a curve, not a straight line', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 5);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });
});
