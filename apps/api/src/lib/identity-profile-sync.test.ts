// syncSeatsFromProfile (v1.253.1): a name or photo changed in my.thread
// reaches every live seat with that email, so one profile never shows two
// names. What is checked is the update handed to the database: which fields,
// which filters — and that an empty name is never written over a seat's.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { table: string; patch: Record<string, unknown>; eq: [string, string][]; is: [string, null][] }[] = [];

vi.mock('../db.js', () => ({
  adminClient: {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => {
        const call = { table, patch, eq: [] as [string, string][], is: [] as [string, null][] };
        calls.push(call);
        const chain = {
          eq: (k: string, v: string) => {
            call.eq.push([k, v]);
            return chain;
          },
          is: async (k: string, v: null) => {
            call.is.push([k, v]);
            return { error: null };
          },
        };
        return chain;
      },
    }),
  },
}));

const { syncSeatsFromProfile } = await import('./identity-profile.js');

beforeEach(() => {
  calls.length = 0;
});

describe('syncSeatsFromProfile', () => {
  it('writes the name to every live seat with that email, lower-cased', async () => {
    await syncSeatsFromProfile(' Marja@Example.com ', { full_name: '  Marja de Vries ' });
    expect(calls).toEqual([{ table: 'user', patch: { full_name: 'Marja de Vries' }, eq: [['email', 'marja@example.com']], is: [['deleted_at', null]] }]);
  });
  it('writes a new photo, and clears it on removal', async () => {
    await syncSeatsFromProfile('a@b.c', { avatar_url: 'https://x/p.jpg' });
    await syncSeatsFromProfile('a@b.c', { avatar_url: null });
    expect(calls.map((c) => c.patch)).toEqual([{ avatar_url: 'https://x/p.jpg' }, { avatar_url: null }]);
  });
  it('never writes an empty name, and writes nothing when there is nothing to write', async () => {
    await syncSeatsFromProfile('a@b.c', { full_name: '   ' });
    await syncSeatsFromProfile('a@b.c', { full_name: null });
    await syncSeatsFromProfile('a@b.c', {});
    expect(calls).toHaveLength(0);
  });
});
