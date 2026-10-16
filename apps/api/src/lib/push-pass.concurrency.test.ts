import { beforeEach, describe, expect, it, vi } from 'vitest';

// Two push passes over the same pending rows — two machines during a
// blue-green deploy, or a run that outlived its lease — must push each group
// ONCE. The claim (pending → sent, only where still pending) is what decides;
// this fakes the database closely enough to let both passes read the same
// pending rows and race on that claim. Every fake call yields to the event
// loop, so the two passes really do interleave.

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const sends: string[] = [];

const tick = () => new Promise((r) => setTimeout(r, 0));

function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: 'select' | 'update' | 'delete' = 'select';
  let patch: Row = {};
  let returning = false;
  const q = {
    select() {
      if (op !== 'select') returning = true;
      return q;
    },
    update(p: Row) {
      op = 'update';
      patch = p;
      return q;
    },
    delete() {
      op = 'delete';
      return q;
    },
    eq(col: string, v: unknown) {
      filters.push((r) => r[col] === v);
      return q;
    },
    in(col: string, vs: unknown[]) {
      filters.push((r) => vs.includes(r[col]));
      return q;
    },
    gte(col: string, v: string) {
      filters.push((r) => typeof r[col] === 'string' && (r[col] as string) >= v);
      return q;
    },
    order: () => q,
    limit: () => q,
    then(resolve: (x: { data: unknown; error: null }) => void) {
      void (async () => {
        await tick();
        const rows = (db[table] ??= []);
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') {
          for (const r of hit) Object.assign(r, patch);
          resolve({ data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
        } else if (op === 'delete') {
          db[table] = rows.filter((r) => !hit.includes(r));
          resolve({ data: null, error: null });
        } else {
          // The one embed the pass uses: member_notification → person.
          const out = hit.map((r) =>
            table === 'member_notification' ? { ...r, person: db.person!.find((p) => p.id === r.person_id) } : { ...r },
          );
          resolve({ data: out, error: null });
        }
      })();
    },
  };
  return q;
}

vi.mock('../db.js', () => ({ adminClient: { from: (t: string) => from(t) } }));
vi.mock('./email/platform-i18n.js', () => ({ platformEmailLocale: async () => 'en' }));
vi.mock('./web-push.js', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    vapidConfig: () => ({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:hello@thethread.app' }),
    sendPush: async (target: { endpoint: string }, payload: { tag: string }) => {
      await tick();
      sends.push(`${target.endpoint}|${payload.tag}`);
      return 'sent';
    },
  };
});

const { runPushPass } = await import('./push-pass.js');

// 14:00 in Amsterdam: not quiet hours.
const NOW = new Date('2026-10-16T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

beforeEach(() => {
  sends.length = 0;
  db.person = [{ id: 'p1', email: 'anna@example.org' }];
  db.push_subscription = [
    { id: 's1', email: 'anna@example.org', endpoint: 'https://fcm.googleapis.com/fcm/send/a', p256dh: 'k', auth: 'a', fail_count: 0, first_fail_at: null },
  ];
  db.thread_thread = [
    { id: 'T1', timezone: 'Europe/Amsterdam' },
    { id: 'T2', timezone: 'Europe/Amsterdam' },
  ];
  db.workspace = [{ id: 'W', name: 'Soul.com' }];
  const base = { workspace_id: 'W', person_id: 'p1', push_state: 'pending', pushed_at: null, starts_at: '2026-10-20T18:00:00Z' };
  db.member_notification = [
    { ...base, id: 'n1', kind: 'session_moved', thread_id: 'T1', subject: 'Rehearsal', created_at: minutesAgo(2) },
    { ...base, id: 'n2', kind: 'session_moved', thread_id: 'T1', subject: 'Rehearsal 2', created_at: minutesAgo(2) },
    { ...base, id: 'n3', kind: 'session_cancelled', thread_id: 'T2', subject: 'Concert', created_at: minutesAgo(1) },
  ];
});

describe('two passes at once', () => {
  it('push each group once, and every row ends sent', async () => {
    await Promise.all([runPushPass(NOW), runPushPass(NOW)]);
    expect(sends.sort()).toEqual([
      'https://fcm.googleapis.com/fcm/send/a|thread:T1',
      'https://fcm.googleapis.com/fcm/send/a|thread:T2',
    ]);
    expect(db.member_notification!.map((r) => r.push_state)).toEqual(['sent', 'sent', 'sent']);
  });

  it('a pass after a finished one finds nothing to send', async () => {
    await runPushPass(NOW);
    sends.length = 0;
    await runPushPass(NOW);
    expect(sends).toEqual([]);
  });
});
