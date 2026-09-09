// Locks the two judgements behind the visitor portal (docs/visitor-portal-proposal.md).

import { describe, expect, it } from 'vitest';
import { enrolmentCanRespond, enrolmentIsLive, mergeById, ticketIsAdmissible, resolveRsvpEnabled } from './portal.js';

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

describe('enrolmentCanRespond', () => {
  // Reachable since v0.68.31: the membership thread worker sets an enrolment
  // to 'dropped' when a membership lapses, soft-delete style. The person
  // keeps seeing the thread and must stop answering for its future sessions.
  it('refuses a dropped enrolment', () => {
    expect(enrolmentCanRespond('dropped')).toBe(false);
  });

  it.each(['enrolled', 'completed', 'pending', 'approved', null])(
    'allows %j — only dropped is out',
    (status) => {
      expect(enrolmentCanRespond(status)).toBe(true);
    },
  );

  it('is deliberately NOT the door rule: money is irrelevant to an RSVP', () => {
    // ticketIsAdmissible would refuse an unpaid ticket at the door. Saying
    // "I'm coming" is not a purchase, and the organiser still wants to know.
    expect(ticketIsAdmissible('enrolled', 'pending')).toBe(false);
    expect(enrolmentCanRespond('enrolled')).toBe(true);
  });
});

describe('enrolmentIsLive — the one fact both predicates share', () => {
  it('is the single definition of "no longer taking part"', () => {
    expect(enrolmentIsLive('dropped')).toBe(false);
    expect(enrolmentIsLive('enrolled')).toBe(true);
  });

  // The point of extracting it: adding 'withdrawn' or 'removed' here must
  // reach BOTH predicates. Before this existed the literal was hand-copied
  // into each, and only one would have been updated.
  it('flows into both, so a new terminal status cannot reach only one', () => {
    for (const status of ['dropped']) {
      expect(enrolmentIsLive(status)).toBe(false);
      expect(enrolmentCanRespond(status)).toBe(false);
      expect(ticketIsAdmissible(status, 'paid')).toBe(false);
    }
  });
});

describe('resolveRsvpEnabled', () => {
  const base = { item: null, thread: null, workspaceDefault: null, hasStart: true };

  it('asks by default — an unconfigured workspace still asks', () => {
    expect(resolveRsvpEnabled(base)).toBe(true);
  });

  it('never asks about an item with no start time', () => {
    expect(resolveRsvpEnabled({ ...base, hasStart: false })).toBe(false);
    expect(resolveRsvpEnabled({ ...base, item: true, hasStart: false })).toBe(false);
  });

  it('the workspace default applies when nothing overrides it', () => {
    expect(resolveRsvpEnabled({ ...base, workspaceDefault: false })).toBe(false);
  });

  it('the thread overrides the workspace, in both directions', () => {
    expect(resolveRsvpEnabled({ ...base, thread: false, workspaceDefault: true })).toBe(false);
    expect(resolveRsvpEnabled({ ...base, thread: true, workspaceDefault: false })).toBe(true);
  });

  it('the item overrides the thread, in both directions', () => {
    expect(resolveRsvpEnabled({ ...base, item: false, thread: true })).toBe(false);
    expect(resolveRsvpEnabled({ ...base, item: true, thread: false })).toBe(true);
  });

  it('null at a level inherits rather than switching off', () => {
    expect(resolveRsvpEnabled({ ...base, item: null, thread: true, workspaceDefault: false })).toBe(true);
    expect(resolveRsvpEnabled({ ...base, item: null, thread: null, workspaceDefault: false })).toBe(false);
  });

  it('undefined behaves as null — a column not selected must not read as off', () => {
    expect(resolveRsvpEnabled({ ...base, item: undefined, thread: undefined, workspaceDefault: undefined })).toBe(true);
  });
});
