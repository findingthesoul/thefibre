import { describe, expect, it } from 'vitest';
import { joinPayment } from './thread-payment-route.js';

// What a member meets on the list, from their price and the thread's working
// routes. The case that started it: €40 owed and no route, which used to be a
// Join button into "the organiser has not connected payments yet".
describe('joinPayment', () => {
  it('nothing to pay needs no route at all — the 100% member keeps one-click Join', () => {
    expect(joinPayment(0, [])).toBe('none_needed');
  });
  it('owed money and a working card route: card checkout', () => {
    expect(joinPayment(4000, ['stripe'])).toBe('card');
    expect(joinPayment(4000, ['stripe', 'invoice'])).toBe('card');
  });
  it('owed money and invoice only: the thread page, where billing details are asked', () => {
    expect(joinPayment(4000, ['invoice'])).toBe('invoice_only');
  });
  it('owed money and NO route: unavailable — never a button', () => {
    expect(joinPayment(4000, [])).toBe('unavailable');
  });
});
