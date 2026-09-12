import { describe, expect, it } from 'vitest';
import { R_MAX, R_MIN, labelWidth, seedPosition, settle, targetRadius, type WebNode } from './web-layout';

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
