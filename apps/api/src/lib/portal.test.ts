// Locks the two judgements behind the visitor portal (docs/visitor-portal-proposal.md).

import { describe, expect, it } from 'vitest';
import { mergeById, ticketIsAdmissible } from './portal.js';

describe('ticketIsAdmissible', () => {
  it('a free thread admits — no payment was ever asked for', () => {
    expect(ticketIsAdmissible('enrolled', null)).toBe(true);
    expect(ticketIsAdmissible('active', null)).toBe(true);
  });

  it('paid, not_required and invoice_sent admit', () => {
    expect(ticketIsAdmissible('enrolled', 'paid')).toBe(true);
    expect(ticketIsAdmissible('enrolled', 'not_required')).toBe(true);
    // The organiser chose to invoice this person and let them in on that basis.
    expect(ticketIsAdmissible('enrolled', 'invoice_sent')).toBe(true);
  });

  it('no QR while money is still outstanding', () => {
    expect(ticketIsAdmissible('enrolled', 'pending')).toBe(false);
    expect(ticketIsAdmissible('enrolled', 'invoice_pending')).toBe(false);
    expect(ticketIsAdmissible('enrolled', 'failed')).toBe(false);
    expect(ticketIsAdmissible('enrolled', 'refunded')).toBe(false);
  });

  it('a dropped enrolment never carries a QR, even when it was paid', () => {
    // Declined applications and withdrawals: the money question is separate
    // from the door question, and the door answer is no.
    expect(ticketIsAdmissible('dropped', 'paid')).toBe(false);
    expect(ticketIsAdmissible('dropped', null)).toBe(false);
  });

  it('an unknown payment status does not admit', () => {
    // Default-deny: a status added later must be considered before it opens
    // a door, rather than admitting by accident.
    expect(ticketIsAdmissible('enrolled', 'something_new')).toBe(false);
  });
});

describe('mergeById', () => {
  it('keeps one copy of a row that matched both keys', () => {
    const byPerson = [{ id: 'a', via: 'person' }];
    const byEmail = [{ id: 'a', via: 'email' }];
    const out = mergeById(byPerson, byEmail);
    expect(out).toHaveLength(1);
    expect(out[0]!.via).toBe('person'); // first list wins
  });

  it('unions rows that only one key finds', () => {
    // The real shape: a booking with a person id, and an older one with only
    // an email on it.
    const out = mergeById([{ id: 'a' }], [{ id: 'b' }]);
    expect(out.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('tolerates null and empty lists', () => {
    expect(mergeById(null, undefined, [])).toEqual([]);
    expect(mergeById(null, [{ id: 'a' }])).toHaveLength(1);
  });
});
