import { describe, expect, it } from 'vitest';
import {
  ASPECT,
  JUNCTION_FRACTION,
  junctionBearing,
  junctionRadius,
  assignBearings,
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
  LEAN_MAX,
  lagOf,
  leanToward,
  step as rawStep,
  targetRadius,
  wander,
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
    // About 6000 frames now. Two things lengthened the tail: the all-pairs
    // push that stops linked clusters collapsing, and then each name trailing
    // the centre on its own slow anchor. The visible movement is over long
    // before that — what remains is drift too small to see — but it does come
    // to rest, and that is worth holding, because a cloud that never settles
    // would churn the processor for as long as the tab is open.
    const nodes = web({ Joost: 3, Aniek: 2, Marja: 1, Daniel: 1, Femke: 2 });
    expect(settle(nodes, 8000)).toBeLessThanOrEqual(0.01);
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
      else if (n === oldCentre) {
        n.targetR = targetRadius(0, 1);
        // Opposite the name that was clicked, measured in the squashed space
        // the ellipse is round in — exactly what the component sets.
        n.bearing = Math.atan2(-came.y, -came.x / ASPECT);
      } else n.targetR = targetRadius(weights[n.id] ?? 1, max);
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

  it('puts the name you came from exactly opposite the one you clicked', () => {
    // Measured across sixteen cases: 175 to 180 degrees. It is this reliable
    // because the bearing is held on purpose — left to the settling alone it
    // drifted as far as 85 degrees, i.e. back onto the side you clicked from.
    for (const a of allAngles()) expect(a).toBeGreaterThan(170);
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

describe('wide, because a screen is wide', () => {
  it('spreads the cloud further sideways than up and down', () => {
    const nodes = web({ A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1 });
    settle(nodes, 2000);
    const around = nodes.filter((n) => !n.centre);
    const width = Math.max(...around.map((n) => Math.abs(n.x)));
    const height = Math.max(...around.map((n) => Math.abs(n.y)));
    expect(width).toBeGreaterThan(height * 1.3);
  });
});

describe('dragging a name', () => {
  it('leaves the held name exactly where the pointer put it', () => {
    const nodes = web({ Joost: 2, Aniek: 1, Marja: 1 });
    settle(nodes);
    const held = nodes.find((n) => n.id === 'Joost')!;
    held.held = true;
    held.x = 40;
    held.y = -25;
    for (let i = 0; i < 60; i += 1) step(nodes);
    expect([held.x, held.y]).toEqual([40, -25]);
  });

  it('makes the others move out of its way, which is how a hidden name appears', () => {
    const nodes = web({ Joost: 1, Aniek: 1, Marja: 1 });
    settle(nodes, 2000);
    const held = nodes.find((n) => n.id === 'Joost')!;
    const other = nodes.find((n) => n.id === 'Aniek')!;
    const before = { x: other.x, y: other.y };
    // Drag Joost right on top of Aniek.
    held.held = true;
    held.x = other.x;
    held.y = other.y;
    for (let i = 0; i < 120; i += 1) step(nodes);
    const moved = Math.hypot(other.x - before.x, other.y - before.y);
    expect(moved).toBeGreaterThan(10);
  });

  it('lets go cleanly, and the cloud settles again', () => {
    const nodes = web({ Joost: 2, Aniek: 1 });
    settle(nodes);
    const held = nodes.find((n) => n.id === 'Joost')!;
    held.held = true;
    held.x = 30;
    held.y = 30;
    for (let i = 0; i < 30; i += 1) step(nodes);
    held.held = false;
    expect(settle(nodes, 2000)).toBeLessThan(0.01);
  });
});

describe('the breathing', () => {
  it('keeps the cloud moving after it has settled', () => {
    const nodes = web({ Joost: 2, Aniek: 1 });
    settle(nodes);
    const before = nodes.map((n) => ({ x: n.x, y: n.y }));
    for (let t = 0; t < 400; t += 16) wander(nodes, t);
    const moved = nodes.map((n, i) => Math.hypot(n.x - before[i]!.x, n.y - before[i]!.y));
    expect(Math.max(...moved)).toBeGreaterThan(0);
  });

  it('drifts far less than a name is wide, so it reads as alive and not as jitter', () => {
    const nodes = web({ Joost: 2, Aniek: 1, Marja: 1 });
    settle(nodes);
    const before = nodes.map((n) => ({ x: n.x, y: n.y }));
    for (let t = 0; t < 4000; t += 16) wander(nodes, t);
    const moved = nodes.map((n, i) => Math.hypot(n.x - before[i]!.x, n.y - before[i]!.y));
    expect(Math.max(...moved)).toBeLessThan(25);
  });

  it('never moves the name in the middle, or a name being dragged', () => {
    const nodes = web({ Joost: 2, Aniek: 1 });
    settle(nodes);
    const centre = nodes[0]!;
    const held = nodes.find((n) => n.id === 'Joost')!;
    held.held = true;
    const cBefore = { x: centre.x, y: centre.y };
    const hBefore = { x: held.x, y: held.y };
    for (let t = 0; t < 2000; t += 16) wander(nodes, t);
    expect([centre.x, centre.y]).toEqual([cBefore.x, cBefore.y]);
    expect([held.x, held.y]).toEqual([hBefore.x, hBefore.y]);
  });
});

describe('the names spread all the way round, even when linked in clusters', () => {
  /** The widest empty wedge, in degrees, measured where the ellipse is round. */
  function widestGap(ids: string[], stride: number, assign = true) {
    const weights: Record<string, number> = {};
    ids.forEach((id, k) => {
      weights[id] = 1 - k * 0.08;
    });
    const nodes = web(weights);
    const links = [];
    for (let k = 0; k + 1 < ids.length; k += stride) links.push({ a: ids[k]!, b: ids[k + 1]!, weight: 0.9 });
    // Exactly what the component does before it lets the springs run.
    // One group: the slots spread evenly, as they did before topics existed.
    if (assign) assignBearings([{ members: nodes.filter((n) => !n.centre) }]);
    settle(nodes, 8000, links);
    const centre = nodes.find((n) => n.centre)!;
    const angles = nodes
      .filter((n) => !n.centre)
      .map((n) => Math.atan2(n.y - centre.y, (n.x - centre.x) / ASPECT))
      .sort((x, y) => x - y);
    const gaps = angles.map((a, i) => (i === 0 ? a + Math.PI * 2 - angles[angles.length - 1]! : a - angles[i - 1]!));
    return (Math.max(...gaps) * 180) / Math.PI;
  }

  const SETS = [
    ['Joost de Graaf', 'Aniek Smit', 'Marja van Dam', 'Daniel Okafor', 'Femke Bos', 'Pieter Jansen', 'Lotte Visser', 'Sanne de Wit', 'Ruben Mulder', 'Eva Kok', 'EBBF'],
    ['Name number 0', 'Name number 1', 'Name number 2', 'Name number 3', 'Name number 4', 'Name number 5', 'Name number 6', 'Name number 7', 'Name number 8', 'Name number 9', 'Name number 10'],
    ['Bram', 'Sofie', 'Hugo', 'Iris', 'Karel', 'Lieve', 'Mees', 'Nina', 'Otto', 'Puck', 'Quinn', 'Rosa'],
  ];

  it('leaves no empty half when several names are linked in chains', () => {
    // Measured over these six cases: 32-36 degrees with the slots assigned.
    for (const ids of SETS) {
      for (const stride of [2, 3]) {
        expect(widestGap(ids, stride), `${ids[0]} / stride ${stride}`).toBeLessThan(60);
      }
    }
  });

  it('needs the slots: without them the links drag the cloud to one side', () => {
    // The twin. Left to the springs alone the same communities settle with
    // wedges of 107 to 204 degrees — half the circle empty. This is why the
    // directions are assigned rather than hoped for.
    const worst = Math.max(...SETS.map((ids) => widestGap(ids, 2, false)));
    expect(worst).toBeGreaterThan(100);
  });
});

describe('the middle leans after the mouse', () => {
  const centreOf = (nodes: WebNode[]) => nodes.find((n) => n.centre)!;

  it('arrives late, not instantly — that is the whole effect', () => {
    const nodes = web({ Joost: 2, Aniek: 1 });
    settle(nodes);
    const centre = centreOf(nodes);
    const pointer = { x: 400, y: 0 };
    const target = leanToward(pointer)!;
    step(nodes, [], undefined, pointer);
    const afterOne = Math.abs(centre.x - target.x);
    // One frame gets nowhere near; a hundred gets there.
    expect(afterOne).toBeGreaterThan(Math.abs(target.x) * 0.5);
    for (let i = 0; i < 200; i += 1) step(nodes, [], undefined, pointer);
    expect(Math.hypot(centre.x - target.x, centre.y - target.y)).toBeLessThan(3);
  });

  it('leans toward the pointer rather than chasing it to the edge', () => {
    // A middle that flies to the frame's edge is no longer the middle of
    // anything, and every line would stretch across the screen.
    const far = leanToward({ x: 5000, y: 0 })!;
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(LEAN_MAX, 5);
    const near = leanToward({ x: 100, y: 0 })!;
    expect(near.x).toBeGreaterThan(0);
    expect(near.x).toBeLessThan(100);
  });

  it('goes home when the mouse leaves', () => {
    const nodes = web({ Joost: 2, Aniek: 1 });
    settle(nodes);
    const centre = centreOf(nodes);
    const pointer = { x: 400, y: 300 };
    for (let i = 0; i < 200; i += 1) step(nodes, [], undefined, pointer);
    expect(Math.hypot(centre.x, centre.y)).toBeGreaterThan(10);
    for (let i = 0; i < 200; i += 1) step(nodes, [], undefined, null);
    expect(Math.hypot(centre.x, centre.y)).toBeLessThan(2);
  });

  it('stays put when there is no pointer at all', () => {
    expect(leanToward(null)).toBeNull();
    expect(leanToward(undefined)).toBeNull();
  });
});

describe('and the rest follows, each on its own', () => {
  /** A settled cloud, then the mouse arrives on the right. */
  function withMouse(frames: number) {
    const nodes = web({ Joost: 2, Aniek: 1.6, Marja: 1.2, Daniel: 1, Femke: 0.8 });
    // As the component does. Without it the cloud settles one-sided, and every
    // line then changes the same way when the middle moves — which is not the
    // picture this is meant to be testing.
    assignBearings([{ members: nodes.filter((n) => !n.centre) }]);
    settle(nodes, 4000);
    const centre = nodes.find((n) => n.centre)!;
    const others = nodes.filter((n) => !n.centre);
    const before = { centre: { ...centre }, others: others.map((n) => ({ ...n })) };
    const pointer = { x: 500, y: 0 };
    for (let i = 0; i < frames; i += 1) step(nodes, [], undefined, pointer);
    return {
      centreMoved: centre.x - before.centre.x,
      eachMoved: others.map((n, i) => n.x - before.others[i]!.x),
      nodes,
      before,
    };
  }

  it('moves the other names too, not just the one in the middle', () => {
    // Before their anchors existed the ring was pinned to the frame, so the
    // middle leaned and nothing else so much as twitched.
    const { eachMoved } = withMouse(400);
    const average = eachMoved.reduce((a, b) => a + b, 0) / eachMoved.length;
    expect(average).toBeGreaterThan(5);
  });

  it('moves them LATER than the middle', () => {
    // Ten frames in, the middle has gone a long way and the rest have hardly
    // started. An earlier version compared the two as a RATIO and passed with
    // the delay removed — the names lag a little anyway, through their own
    // springs — so the bar is on the absolute figures.
    const { centreMoved, eachMoved } = withMouse(10);
    const average = eachMoved.reduce((a, b) => a + b, 0) / eachMoved.length;
    expect(centreMoved).toBeGreaterThan(20);
    expect(average).toBeLessThan(3);
  });

  it('moves each name at its OWN pace, not as a block', () => {
    // Sjoerd: "the following should be all independent connections... not as a
    // block... so the connecting strings stretch and contract independent".
    // With one shared anchor every name moved by the same amount; now the
    // quickest travels several times as far as the slowest at the same moment.
    const { eachMoved } = withMouse(60);
    const spread = Math.max(...eachMoved) - Math.min(...eachMoved);
    expect(spread).toBeGreaterThan(5);
  });

  it('stretches some lines and shortens others while it moves', () => {
    const { nodes, before } = withMouse(30);
    const centre = nodes.find((n) => n.centre)!;
    const others = nodes.filter((n) => !n.centre);
    const change = others.map((n, i) => {
      const now = Math.hypot(n.x - centre.x, n.y - centre.y);
      const was = Math.hypot(before.others[i]!.x - before.centre.x, before.others[i]!.y - before.centre.y);
      return now - was;
    });
    expect(Math.max(...change)).toBeGreaterThan(1);
    expect(Math.min(...change)).toBeLessThan(-1);
  });

  it('gives the same person the same lag every time', () => {
    // Their own pace, not a random shimmer that differs per visit.
    expect(lagOf('wilma')).toBe(lagOf('wilma'));
    expect(lagOf('wilma')).not.toBe(lagOf('joost'));
  });
});

describe('where a topic sits between the middle and its names', () => {
  const deg = (r: number) => (r * 180) / Math.PI;

  it('points at the average of the names hanging off it', () => {
    expect(deg(junctionBearing([0, Math.PI / 2]))).toBeCloseTo(45, 5);
  });

  it('averages correctly across the wrap-around', () => {
    // Two names either side of due west. A plain arithmetic mean would send
    // the topic due EAST, to the opposite side of the cloud from its members.
    const almostPi = Math.PI - 0.2;
    const justPast = -Math.PI + 0.2;
    expect(Math.abs(deg(junctionBearing([almostPi, justPast])))).toBeCloseTo(180, 5);
  });

  it('never returns nothing, even for names pointing exactly apart', () => {
    const b = junctionBearing([0, Math.PI]);
    expect(Number.isFinite(b)).toBe(true);
  });

  it('sits between the middle and its closest name', () => {
    const r = junctionRadius([300, 400]);
    expect(r).toBeCloseTo(300 * JUNCTION_FRACTION, 5);
    expect(r).toBeLessThan(300);
    expect(r).toBeGreaterThan(0);
  });

  it('has somewhere to sit even with no names yet', () => {
    expect(junctionRadius([])).toBeGreaterThan(0);
  });
});
