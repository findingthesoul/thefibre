// markEmailProven is conditional: one stamp per address per ten minutes per
// process. What matters is the two edges — it does skip a repeat (that is the
// speed), and a FAILED stamp is not remembered (that would turn one hiccup
// into ten minutes of an unverified address).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const updates: string[] = [];
let failNext = false;

vi.mock('../db.js', () => {
  const chain = (value: { v?: string }) => ({
    eq: (col: string, v: string) => {
      if (col === 'value') value.v = v;
      return chain(value);
    },
    is: () => {
      updates.push(value.v ?? '');
      const error = failNext ? { message: 'down' } : null;
      failNext = false;
      return Promise.resolve({ error });
    },
  });
  return { adminClient: { from: () => ({ update: () => chain({}) }) } };
});

const { markEmailProven } = await import('./proven-email.js');

beforeEach(() => {
  updates.length = 0;
});

describe('markEmailProven', () => {
  it('stamps once, then skips the same address for ten minutes', async () => {
    await markEmailProven('A@example.com', 1_000);
    await markEmailProven('a@example.com', 2_000);
    expect(updates).toEqual(['a@example.com']);
    await markEmailProven('a@example.com', 1_000 + 10 * 60_000);
    expect(updates).toEqual(['a@example.com', 'a@example.com']);
  });

  it('does not remember a failed stamp', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failNext = true;
    await markEmailProven('b@example.com', 1_000);
    await markEmailProven('b@example.com', 2_000);
    expect(updates).toEqual(['b@example.com', 'b@example.com']);
  });
});
