import { describe, expect, it } from 'vitest';
import { renewalNeedsCard } from './renewal-card.js';

const JAN_1 = Math.floor(Date.UTC(2027, 0, 1) / 1000);
const base = { status: 'trialing' as const, cancel_at_period_end: false, collection_method: 'charge_automatically' as const, trial_end: JAN_1, period_end: JAN_1 };

describe('renewalNeedsCard', () => {
  it('a prepaid (trialing) member with no card needs one by the trial end', () => {
    expect(renewalNeedsCard(base, false)).toEqual({ needs_card: true, on: '2027-01-01T00:00:00.000Z' });
  });
  it('a card on file: nothing needed', () => {
    expect(renewalNeedsCard(base, true)).toEqual({ needs_card: false, on: null });
  });
  it('billed by invoice (send_invoice): no card needed', () => {
    expect(renewalNeedsCard({ ...base, collection_method: 'send_invoice' }, false).needs_card).toBe(false);
  });
  it('stopping at the period end: no renewal, no card needed', () => {
    expect(renewalNeedsCard({ ...base, cancel_at_period_end: true }, false).needs_card).toBe(false);
  });
  it('canceled or incomplete subscriptions never ask', () => {
    for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'] as const) {
      expect(renewalNeedsCard({ ...base, status }, false).needs_card, status).toBe(false);
    }
  });
  it('an active subscription uses its period end', () => {
    const end = Math.floor(Date.UTC(2027, 5, 1) / 1000);
    expect(renewalNeedsCard({ ...base, status: 'active', trial_end: null, period_end: end }, false)).toEqual({ needs_card: true, on: '2027-06-01T00:00:00.000Z' });
  });
});
