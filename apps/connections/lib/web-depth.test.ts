import { describe, expect, it } from 'vitest';
import { byDepth, depthStyle, easeDepth, parallax, targetDepth } from './web-depth';

const name = (strength: number, full = true) => ({ centre: false, strength, full });

describe('what is near and what is far', () => {
  it('puts the middle nearest', () => {
    expect(targetDepth({ centre: true, strength: 1 }, null)).toBe(1);
  });

  it('puts a strong connection nearer than a weak one', () => {
    expect(targetDepth(name(0.9), null)).toBeGreaterThan(targetDepth(name(0.1), null));
  });

  it('puts a name with content nearer than the same name empty', () => {
    // Sjoerd: nodes are full (have content) or empty (unclear, for overview).
    expect(targetDepth(name(0.5, true), null)).toBeGreaterThan(targetDepth(name(0.5, false), null));
  });

  it('brings what you point at, and what it connects to, forward — and sends the rest back', () => {
    const weak = name(0.1, false);
    expect(targetDepth(weak, 'self')).toBe(1);
    expect(targetDepth(weak, 'related')).toBeGreaterThan(targetDepth(weak, null));
    expect(targetDepth(name(0.9), 'other')).toBeLessThan(targetDepth(name(0.9), null));
  });

  it('keeps every depth between far and near', () => {
    for (const s of [-1, 0, 0.5, 1, 3]) {
      const d = targetDepth(name(s), null);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });
});

describe('how a depth looks', () => {
  it('draws near larger and brighter than far', () => {
    const near = depthStyle(1);
    const far = depthStyle(0);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.opacity).toBeGreaterThan(far.opacity);
  });

  it('stays subtle: a few percent of size and light, never a statement', () => {
    // Sjoerd, 2026-09-15: "the contrast are way too heavy. It is about subtle
    // changes. Not big changes." The first version went 0.62x-1.22x and down
    // to 38% light. These bounds are his answer; widen them only if he asks.
    for (const z of [0, 0.25, 0.5, 0.75, 1]) {
      const st = depthStyle(z);
      expect(st.scale).toBeGreaterThanOrEqual(0.88);
      expect(st.scale).toBeLessThanOrEqual(1.08);
      expect(st.opacity).toBeGreaterThanOrEqual(0.7);
      expect(st.blur).toBeLessThanOrEqual(0.3);
    }
    expect(Math.abs(parallax(1, { x: 300, y: 0 }).dx)).toBeLessThanOrEqual(4);
  });

  it('softens only far things, and only a little', () => {
    expect(depthStyle(0.8).blur).toBe(0);
    expect(depthStyle(0).blur).toBeGreaterThan(0);
    expect(depthStyle(0).blur).toBeLessThan(1.2);
  });

  it('moves near things with the pointer and far things against it', () => {
    const p = { x: 100, y: -40 };
    expect(parallax(1, p).dx).toBeGreaterThan(0);
    expect(parallax(0, p).dx).toBeLessThan(0);
    expect(parallax(0.5, p)).toEqual({ dx: 0, dy: -0 });
    expect(parallax(1, null)).toEqual({ dx: 0, dy: 0 });
  });

  it('eases toward the target instead of jumping, and lands exactly', () => {
    const one = easeDepth(0, 1);
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(1);
    let d = 0;
    for (let i = 0; i < 200; i++) d = easeDepth(d, 1);
    expect(d).toBe(1);
    expect(easeDepth(undefined, 0.4)).toBe(0.4);
  });

  it('paints far first so near covers it', () => {
    const order = byDepth(
      [{ id: 'near' }, { id: 'far' }, { id: 'mid' }],
      (n) => ({ near: 0.9, far: 0.1, mid: 0.5 })[n.id]!,
    );
    expect(order.map((n) => n.id)).toEqual(['far', 'mid', 'near']);
  });
});
