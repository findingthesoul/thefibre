import { describe, expect, it } from 'vitest';
import { hasRequiredQuestion, heldThreadIds, holdsTeamCalendar } from './could-join.js';

// A one-click join from my.thread must never skip a question the organiser
// made REQUIRED: that member answers it on the thread's own page instead.
describe('hasRequiredQuestion', () => {
  it('is false for no fields, an empty list, or only optional questions', () => {
    expect(hasRequiredQuestion(null)).toBe(false);
    expect(hasRequiredQuestion(undefined)).toBe(false);
    expect(hasRequiredQuestion([])).toBe(false);
    expect(hasRequiredQuestion([{ key: 'a', required: false }, { key: 'b' }])).toBe(false);
  });

  it('is true when any one question is required', () => {
    expect(hasRequiredQuestion([{ key: 'a' }, { key: 'diet', required: true }])).toBe(true);
  });

  it('does not trust a truthy string — only `true` makes a question required', () => {
    expect(hasRequiredQuestion([{ key: 'a', required: 'yes' }])).toBe(false);
    expect(hasRequiredQuestion('not an array')).toBe(false);
    expect(hasRequiredQuestion([null, 3])).toBe(false);
  });
});

// The nav item follows the entitlement, not the list: a member whose calendar
// is empty this month still finds "Upcoming" and is told so.
describe('holdsTeamCalendar', () => {
  it('is true when any membership carries a calendar, even if others carry none', () => {
    expect(holdsTeamCalendar(new Map([['m1', []], ['m2', [{ teamId: 't', pct: 0 }]]]))).toBe(true);
  });
  it('is false for no memberships, or memberships that carry nothing', () => {
    expect(holdsTeamCalendar(new Map())).toBe(false);
    expect(holdsTeamCalendar(new Map([['m1', []]]))).toBe(false);
  });
});

// The list must offer exactly the joins the enrol route accepts. The route
// answers already_enrolled for any existing place EXCEPT an unpaid one, which
// it reuses so the payment can be finished.
describe('heldThreadIds matches POST /thread/public/enrol', () => {
  const held = (payment_status: string | null) =>
    heldThreadIds([{ thread_id: 't', payment_status }]).has('t');

  it('a paid, free or invoiced place is held: the route would answer already_enrolled', () => {
    expect(held('paid')).toBe(true);
    expect(held('not_required')).toBe(true);
    expect(held(null)).toBe(true);
  });

  it('an UNPAID place is not held: the route reuses it and runs the payment again', () => {
    expect(held('pending')).toBe(false);
    expect(held('failed')).toBe(false);
  });

  it('a row without a thread is ignored', () => {
    expect(heldThreadIds([{ thread_id: null, payment_status: 'paid' }]).size).toBe(0);
  });
});
