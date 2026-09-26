// The scheduler lease against the real staging database: two holders racing
// for one name get exactly one winner; a released lease is free at once; an
// abandoned lease is free after its TTL; the same holder may re-enter.
//
// This is the whole guarantee that blue-green deploys (two processes for a
// moment) and a future second machine rest on — so it is tested where it
// runs, not mocked.
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient } from '../db.js';
import { withSchedulerLease } from '../lib/scheduler-lease.js';

const NAME = `int-test-lease-${Date.now()}`;

afterAll(async () => {
  await adminClient.from('scheduler_lease').delete().like('name', 'int-test-lease-%');
});

describe('scheduler lease (staging)', () => {
  it('two holders racing for one name: exactly one runs', async () => {
    let runs = 0;
    const tick = () => async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 300));
    };
    const [a, b] = await Promise.all([
      withSchedulerLease(NAME, 30_000, tick(), 'holder-a'),
      withSchedulerLease(NAME, 30_000, tick(), 'holder-b'),
    ]);
    expect([a, b].sort()).toEqual(['ran', 'skipped']);
    expect(runs).toBe(1);
  });

  it('a released lease is free immediately, for another holder', async () => {
    const first = await withSchedulerLease(NAME, 30_000, async () => {}, 'holder-a');
    expect(first).toBe('ran');
    const second = await withSchedulerLease(NAME, 30_000, async () => {}, 'holder-b');
    expect(second).toBe('ran');
  });

  it('an abandoned lease frees itself after the TTL', async () => {
    const name = `${NAME}-ttl`;
    const { data: won } = await adminClient.rpc('try_scheduler_lease', {
      p_name: name,
      p_holder: 'crashed-process',
      p_ttl_seconds: 1,
    });
    expect(won).toBe(true);
    const tooSoon = await withSchedulerLease(name, 30_000, async () => {}, 'holder-b');
    expect(tooSoon).toBe('skipped');
    await new Promise((r) => setTimeout(r, 1_500));
    const later = await withSchedulerLease(name, 30_000, async () => {}, 'holder-b');
    expect(later).toBe('ran');
  });

  it('the row is service-role only: the anon key cannot read it', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await anon.from('scheduler_lease').select('name').limit(1);
    expect(error ?? null).toBeNull();
    expect(data).toEqual([]);
    const { error: rpcErr } = await anon.rpc('try_scheduler_lease', {
      p_name: NAME,
      p_holder: 'anon',
      p_ttl_seconds: 5,
    });
    expect(rpcErr?.code).toBe('42501');
  });
});
