import { describe, expect, it } from 'vitest';
import { planWorkspaceSync } from './workspace-sync.js';

// The rules that matter are about the RELOAD, not the refresh. Resolving a
// stale workspace needs a full document load, and a document load remounts
// everything — so the only thing standing between "fix the workspace" and
// "reload forever in every app" is a guard that survives the reload. These
// cases are that guard.

const KEY = 'thefibre.ws-sync.attempted';

/** A storage that works. */
function okStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    store: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    },
    map,
  };
}

/** A storage that refuses to write — a private window, blocked site data. */
const throwingStore = {
  getItem: () => null,
  setItem: () => {
    throw new Error('QuotaExceededError: storage is not available');
  },
};

/** One that refuses to be read from as well. */
const deadStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

describe('planWorkspaceSync', () => {
  it('does nothing when the workspaces agree', () => {
    const { store } = okStore();
    expect(planWorkspaceSync({ stale: false, syncKey: null, storage: store })).toEqual({
      refresh: false,
      reload: false,
    });
  });

  it('does nothing without a key, even if told it is stale', () => {
    const { store } = okStore();
    expect(planWorkspaceSync({ stale: true, syncKey: null, storage: store })).toEqual({
      refresh: false,
      reload: false,
    });
  });

  it('refreshes and reloads the first time, and records the pair', () => {
    const { store, map } = okStore();
    expect(planWorkspaceSync({ stale: true, syncKey: 'w1->w2', storage: store })).toEqual({
      refresh: true,
      reload: true,
    });
    expect(map.get(KEY)).toBe('w1->w2');
  });

  // The loop guard. A refresh that does not move the token leaves the same
  // disagreement on the next mount; without this it reloads forever.
  it('does nothing the second time for the SAME disagreement', () => {
    const { store } = okStore({ [KEY]: 'w1->w2' });
    expect(planWorkspaceSync({ stale: true, syncKey: 'w1->w2', storage: store })).toEqual({
      refresh: false,
      reload: false,
    });
  });

  it('still acts on a DIFFERENT disagreement later', () => {
    const { store } = okStore({ [KEY]: 'w1->w2' });
    expect(planWorkspaceSync({ stale: true, syncKey: 'w2->w3', storage: store })).toEqual({
      refresh: true,
      reload: true,
    });
  });

  // THE ONE THAT MATTERS MOST, and the hole in the first version of this
  // change: with no durable guard, "fall back to the in-memory guard" is no
  // fallback at all, because the reload is what resets it. So it must fail
  // CLOSED — refresh the token (harmless; the next navigation picks it up)
  // and never reload.
  it('refreshes but does NOT reload when storage cannot be written', () => {
    expect(
      planWorkspaceSync({ stale: true, syncKey: 'w1->w2', storage: throwingStore }),
      'a reload with no guard that survives it is an infinite reload loop',
    ).toEqual({ refresh: true, reload: false });
  });

  it('refreshes but does NOT reload when storage cannot be read either', () => {
    expect(planWorkspaceSync({ stale: true, syncKey: 'w1->w2', storage: deadStore })).toEqual({
      refresh: true,
      reload: false,
    });
  });

  it('refreshes but does NOT reload when there is no storage at all', () => {
    expect(planWorkspaceSync({ stale: true, syncKey: 'w1->w2', storage: null })).toEqual({
      refresh: true,
      reload: false,
    });
  });
});
