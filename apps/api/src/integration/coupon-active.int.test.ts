// A discount code that is switched OFF must not be redeemable — asserted
// against the real staging API and a real row, because this is a money rule
// and the enforcement is one `.eq('is_active', true)` in findValidCoupon.
//
// Why it is worth a test of its own: the Thread pricing panel seeds an
// example EARLYBIRD code the first time an organiser flips a thread to Paid.
// That write happens on a TOGGLE, before any Save, and the dialog's Cancel
// cannot undo it, because the coupon list is its own API-backed list rather
// than form state. Until v0.72.8 it was seeded ACTIVE, so merely opening
// Pricing to look at the options left a live 10% discount on the thread that
// anyone guessing the word could redeem once a ticket existed.
//
// The fix was to seed it inactive. That fix is only safe for as long as
// inactive means unredeemable, which is what this file locks.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  cleanupPublicThreadFixture,
  createPublicThreadFixture,
  service,
  type PublicThreadFixture,
} from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let f: PublicThreadFixture;
const CODE = `INT${randomUUID().slice(0, 6).toUpperCase()}`;

async function validate(code: string) {
  const r = await fetch(`${API}/api/v1/thread/public/validate-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organiser_slug: f.organiserSlug,
      thread_slug: f.threadSlug,
      code,
    }),
  });
  return (await r.json()) as { valid?: boolean; reason?: string };
}

async function setActive(is_active: boolean) {
  const { error } = await service
    .from('thread_coupon')
    .update({ is_active })
    .eq('thread_id', f.threadId)
    .eq('code', CODE);
  if (error) throw new Error(`coupon update: ${error.message}`);
}

beforeAll(async () => {
  f = await createPublicThreadFixture('coupon');
  const { error } = await service.from('thread_coupon').insert({
    workspace_id: f.workspaceId,
    thread_id: f.threadId,
    code: CODE,
    name: 'Integration early bird',
    type: 'percentage',
    discount_percentage: 10,
    is_active: false,
  });
  if (error) throw new Error(`coupon insert: ${error.message}`);
}, 60_000);

afterAll(async () => {
  if (f) {
    await service.from('thread_coupon').delete().eq('thread_id', f.threadId).eq('code', CODE);
    await cleanupPublicThreadFixture(f, []);
  }
}, 60_000);

describe('POST /thread/public/validate-coupon — is_active is the gate', () => {
  it('refuses a code that is switched off', async () => {
    const r = await validate(CODE);

    expect(r.valid).toBe(false);
    // Deliberately the same wording as a code that does not exist: telling a
    // stranger "that one is switched off" confirms the code is real and
    // invites them back tomorrow.
    expect(r.reason).toBe('this code is not valid');
  });

  it('accepts the same code once it is switched on', async () => {
    await setActive(true);
    try {
      const r = await validate(CODE);
      expect(r.valid, JSON.stringify(r)).toBe(true);
    } finally {
      await setActive(false);
    }
  });

  it('still refuses it after being switched off again', async () => {
    const r = await validate(CODE);

    expect(r.valid).toBe(false);
  });

  it('matches the code case-insensitively, so the gate cannot be dodged by case', async () => {
    await setActive(true);
    try {
      const lower = await validate(CODE.toLowerCase());
      expect(lower.valid, JSON.stringify(lower)).toBe(true);
    } finally {
      await setActive(false);
    }
    const offLower = await validate(CODE.toLowerCase());
    expect(offLower.valid).toBe(false);
  });
});
