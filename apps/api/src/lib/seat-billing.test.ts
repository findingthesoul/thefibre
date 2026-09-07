// The seat reconciler's pure decision, extracted (v0.54.0) so the
// deliberately ASYMMETRIC proration is locked as a test, not folklore
// (Sjoerd, 2026-09-04): every GROW prorates from today; every SHRINK —
// including removing the item — carries no credit; the paid month runs
// out and the next invoice counts fewer.

import { describe, expect, it } from 'vitest';
import { seatItemAction } from './seat-billing.js';

describe('seatItemAction', () => {
  it('no item + no overage → nothing', () => {
    expect(seatItemAction(null, 0)).toEqual({ op: 'none' });
  });

  it('grow from nothing → create, prorated from today', () => {
    expect(seatItemAction(null, 3)).toEqual({
      op: 'create',
      quantity: 3,
      proration: 'create_prorations',
    });
  });

  it('overage reaching 0 with an existing item → DELETE with no credit (never update-to-0)', () => {
    expect(seatItemAction(2, 0)).toEqual({ op: 'delete', proration: 'none' });
    expect(seatItemAction(1, 0)).toEqual({ op: 'delete', proration: 'none' });
  });

  it('quantity already right → nothing (idempotent against the webhook echo)', () => {
    expect(seatItemAction(2, 2)).toEqual({ op: 'none' });
  });

  it('grow → update with proration', () => {
    expect(seatItemAction(1, 4)).toEqual({
      op: 'update',
      quantity: 4,
      proration: 'create_prorations',
    });
  });

  it('shrink (but not to zero) → update with NO credit', () => {
    expect(seatItemAction(4, 1)).toEqual({ op: 'update', quantity: 1, proration: 'none' });
  });
});
