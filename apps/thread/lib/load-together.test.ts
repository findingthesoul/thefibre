import { describe, expect, it } from 'vitest';
import { loadTogether } from './load-together';

class NotFound extends Error {}
const notFound = (e: unknown): never => {
  if ((e as { status?: number }).status === 404) throw new NotFound();
  throw e;
};

describe('loadTogether — the main fetch decides the page', () => {
  it('both succeed: both results', async () => {
    expect(await loadTogether(Promise.resolve('thread'), Promise.resolve([1, 2]), notFound)).toEqual(['thread', [1, 2]]);
  });

  it('the thread 404s: still not found, even though the side loads succeeded', async () => {
    await expect(loadTogether(Promise.reject({ status: 404 }), Promise.resolve([1]), notFound)).rejects.toBeInstanceOf(NotFound);
  });

  it('the thread fails otherwise (403, 500): that error is thrown, as before', async () => {
    const boom = { status: 403 };
    await expect(loadTogether(Promise.reject(boom), Promise.resolve([1]), notFound)).rejects.toBe(boom);
  });

  it('they really run together: the side load starts before the main one finishes', async () => {
    const order: string[] = [];
    const main = new Promise<string>((r) => setTimeout(() => (order.push('main done'), r('t')), 20));
    const side = (async () => (order.push('side started'), 's'))();
    await loadTogether(main, side, notFound);
    expect(order).toEqual(['side started', 'main done']);
  });
});
