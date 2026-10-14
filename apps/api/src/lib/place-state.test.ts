import { describe, expect, it } from 'vitest';
import { duplicateAnswer, joinableFromList, placeState, type PlaceFacts } from './place-state.js';

// THE LIST AND THE ROUTE AGREE. Every "Join" list asks joinableFromList; the
// enrol route asks duplicateAnswer. These rows are the cases that matter for
// money, and for each one the test states what the ROUTE does and asserts the
// list offers a join exactly when the route would take it.
const ROWS: { name: string; facts: PlaceFacts; route: ReturnType<typeof duplicateAnswer> }[] = [
  {
    name: 'card checkout pending (bailed)',
    facts: { enrolmentStatus: 'invited', paymentStatus: 'pending', invoiced: false },
    route: 'reuse',
  },
  {
    name: 'invoice issued, not yet paid',
    facts: { enrolmentStatus: 'invited', paymentStatus: 'pending', invoiced: true },
    route: 'invoice_open',
  },
  {
    name: 'paid',
    facts: { enrolmentStatus: 'enrolled', paymentStatus: 'paid', invoiced: false },
    route: 'already',
  },
  {
    // A card attempt failed, then the organiser invoiced the same place: the
    // invoice wins, or the person could pay by card AND by invoice.
    name: 'card failed, then invoiced',
    facts: { enrolmentStatus: 'invited', paymentStatus: 'failed', invoiced: true },
    route: 'invoice_open',
  },
  {
    // Declined by the organiser (or a membership place withdrawn). Not
    // reopened by signing up again — they would have to be declined again
    // on every approval thread.
    name: 'declined (dropped), was paid',
    facts: { enrolmentStatus: 'dropped', paymentStatus: 'paid', invoiced: false },
    route: 'closed',
  },
  {
    name: 'declined and refunded',
    facts: { enrolmentStatus: 'dropped', paymentStatus: 'refunded', invoiced: false },
    route: 'closed',
  },
  {
    // Declined with a card checkout still pending: closed wins over the
    // retry, so a declined person cannot pay their way back in.
    name: 'declined with a card checkout pending',
    facts: { enrolmentStatus: 'dropped', paymentStatus: 'pending', invoiced: false },
    route: 'closed',
  },
  {
    // Declined while an invoice is still open: the invoice stands until the
    // organiser settles or voids it, and the member is told about the invoice.
    name: 'declined with an invoice still open',
    facts: { enrolmentStatus: 'dropped', paymentStatus: 'pending', invoiced: true },
    route: 'invoice_open',
  },
  {
    name: 'free place',
    facts: { enrolmentStatus: 'enrolled', paymentStatus: 'not_required', invoiced: false },
    route: 'already',
  },
];

describe('the enrol route and the Join lists answer the same', () => {
  for (const row of ROWS) {
    it(`${row.name}: route ${row.route}, list ${row.route === 'reuse' ? 'offers Join' : 'does not'}`, () => {
      const state = placeState(row.facts);
      expect(duplicateAnswer(state, true)).toBe(row.route);
      expect(joinableFromList(state, true)).toBe(row.route === 'reuse');
    });
  }

  it('a card retry on something that now costs nothing is a held place, on both sides', () => {
    const state = placeState({ enrolmentStatus: 'invited', paymentStatus: 'pending', invoiced: false });
    expect(duplicateAnswer(state, false)).toBe('already');
    expect(joinableFromList(state, false)).toBe(false);
  });

  it('no place at all is always joinable', () => {
    expect(joinableFromList(undefined, true)).toBe(true);
    expect(joinableFromList(undefined, false)).toBe(true);
  });
});
