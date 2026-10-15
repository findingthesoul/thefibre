import { describe, expect, it } from 'vitest';
import { changeInvites, collapseDecision, invitedAfter, planRecipients } from './calendar-invite.js';

// Hosts in the calendar (Sjoerd, 2026-10-14, "And A."): a session's ticked
// hosts receive its invitation and its updates; unticking one after it went
// out sends them a CANCEL of the same event at the next SEND.
const P = [{ email: 'pat@example.com', name: 'Pat' }];
const anna = { email: 'anna@example.com', name: 'Anna' };
const peter = { email: 'peter@example.com', name: 'Peter' };
const by = (rs: ReturnType<typeof planRecipients>) => Object.fromEntries(rs.map((r) => [r.email, `${r.method}${r.hostChange ? `:${r.hostChange}` : ''}`]));

describe('who gets which copy', () => {
  it('first send: participants and ticked hosts get the invitation', () => {
    expect(by(planRecipients({ kind: 'added', participants: P, hostsNow: [anna], invitedHosts: [] }))).toEqual({
      'pat@example.com': 'REQUEST',
      'anna@example.com': 'REQUEST:added',
    });
  });
  it('a move reaches every host still ticked, and CANCELs the one unticked', () => {
    expect(by(planRecipients({ kind: 'moved', participants: P, hostsNow: [anna], invitedHosts: ['anna@example.com', 'peter@example.com'] }))).toEqual({
      'pat@example.com': 'REQUEST',
      'anna@example.com': 'REQUEST',
      'peter@example.com': 'CANCEL:removed',
    });
  });
  it('a hosts-only change writes to the changed hosts and NEVER to participants', () => {
    expect(by(planRecipients({ kind: 'people', participants: P, hostsNow: [anna, peter], invitedHosts: ['anna@example.com'] }))).toEqual({
      'peter@example.com': 'REQUEST:added',
    });
    expect(by(planRecipients({ kind: 'people', participants: P, hostsNow: [], invitedHosts: ['anna@example.com'] }))).toEqual({
      'anna@example.com': 'CANCEL:removed',
    });
  });
  it('a cancellation reaches participants and every host who held it', () => {
    expect(by(planRecipients({ kind: 'cancelled', participants: P, hostsNow: [], invitedHosts: ['anna@example.com'] }))).toEqual({
      'pat@example.com': 'CANCEL',
      'anna@example.com': 'CANCEL',
    });
  });
  it('the organiser is never an attendee; a host who is also a participant gets one copy', () => {
    const rs = planRecipients({ kind: 'added', participants: [{ email: 'anna@example.com', name: 'Anna' }], hostsNow: [anna, { email: 'Olga@Example.com', name: 'Olga' }], invitedHosts: [], organiserEmail: 'olga@example.com' });
    expect(by(rs)).toEqual({ 'anna@example.com': 'REQUEST' });
  });
  it('who holds the invitation after the send', () => {
    const rs = planRecipients({ kind: 'moved', participants: P, hostsNow: [anna], invitedHosts: ['peter@example.com'] });
    expect(invitedAfter('moved', rs, [anna])).toEqual(['anna@example.com']);
    expect(invitedAfter('cancelled', rs, [anna])).toEqual([]);
  });
});

describe('one event: the same UID and SEQUENCE on every copy', () => {
  it('a host’s CANCEL is the SAME event as the participants’ update', () => {
    const recipients = planRecipients({ kind: 'moved', participants: P, hostsNow: [anna], invitedHosts: ['peter@example.com'] });
    const invites = changeInvites({
      uid: 'session-123@thethread.app',
      sequence: 4,
      recipients,
      startsAt: new Date('2026-11-10T10:00:00Z'),
      endsAt: new Date('2026-11-10T11:00:00Z'),
      summary: 'Session',
      description: 'Thread',
      location: null,
      url: null,
      organizerName: 'Olga',
      organizerEmail: 'noreply@thethread.app',
      cancelled: false,
    });
    expect(invites).toHaveLength(3);
    for (const { ics } of invites) {
      expect(ics).toMatch(/UID:session-123@thethread\.app/);
      expect(ics).toMatch(/SEQUENCE:4/);
    }
    const peterIcs = invites.find((i) => i.recipient.email === 'peter@example.com')!.ics;
    expect(peterIcs).toMatch(/METHOD:CANCEL/);
    expect(peterIcs).toMatch(/STATUS:CANCELLED/);
    // Each copy names only its own recipient.
    expect(peterIcs).not.toMatch(/pat@example\.com/);
  });
});

describe('queueing a change of hosts', () => {
  it('never sent: nothing to correct', () => {
    expect(collapseDecision({ everSent: false, pendingKind: null, kind: 'people' })).toEqual({ do: 'ignore' });
  });
  it('sent, nothing queued: a hosts change is queued', () => {
    expect(collapseDecision({ everSent: true, pendingKind: null, kind: 'people' })).toEqual({ do: 'insert', kind: 'people' });
  });
  it('a bigger change already queued carries it (its send diffs the hosts too)', () => {
    expect(collapseDecision({ everSent: true, pendingKind: 'moved', kind: 'people' })).toEqual({ do: 'ignore' });
  });
  it('a real change landing on a queued hosts change takes it over', () => {
    expect(collapseDecision({ everSent: true, pendingKind: 'people', kind: 'moved' })).toEqual({ do: 'update', kind: 'moved' });
    expect(collapseDecision({ everSent: true, pendingKind: 'people', kind: 'cancelled' })).toEqual({ do: 'update', kind: 'cancelled' });
  });
});
