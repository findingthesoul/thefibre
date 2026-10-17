// The calendar state my.thread reads says `follows` by the calendar window's
// own rule (calendar-window.ts `feedFollows`), 2026-10-17. Against staging's
// database; one throwaway feed row, removed afterwards.
//
// Pinned: read an hour ago → follows; read 15 days ago → not; never read →
// not; no live row (revoked) → not subscribed and not following.

import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { service } from './staging.js';
import { feedStatusForEmail } from '../lib/calendar-feed.js';

const DAY = 86_400_000;
const email = `int-follows-${randomUUID().slice(0, 6)}@example.com`;

afterAll(async () => {
  await service.from('person_calendar_feed').delete().eq('email', email);
  const { data } = await service.from('person_calendar_feed').select('id').eq('email', email);
  expect(data ?? []).toEqual([]);
});

describe('feedStatusForEmail: follows', () => {
  it('follows exactly when the window would skip the person', async () => {
    const ins = await service
      .from('person_calendar_feed')
      .insert({ email, token_hash: `int-${randomUUID()}`, last_read_at: new Date(Date.now() - 3_600_000).toISOString() })
      .select('id')
      .single();
    if (ins.error) throw new Error(ins.error.message);
    const id = ins.data.id as string;

    expect(await feedStatusForEmail(email)).toMatchObject({ subscribed: true, follows: true });

    await service.from('person_calendar_feed').update({ last_read_at: new Date(Date.now() - 15 * DAY).toISOString() }).eq('id', id);
    expect(await feedStatusForEmail(email)).toMatchObject({ subscribed: true, follows: false });

    await service.from('person_calendar_feed').update({ last_read_at: null }).eq('id', id);
    expect(await feedStatusForEmail(email)).toMatchObject({ subscribed: true, follows: false });

    await service.from('person_calendar_feed').update({ last_read_at: new Date().toISOString(), revoked_at: new Date().toISOString() }).eq('id', id);
    expect(await feedStatusForEmail(email)).toMatchObject({ subscribed: false, follows: false });
  });
});
