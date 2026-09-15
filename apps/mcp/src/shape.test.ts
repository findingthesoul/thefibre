import { describe, expect, it } from 'vitest';
import {
  activityEntry,
  engagementRow,
  enrolmentRow,
  flowRunEntry,
  fullName,
  mergeTimeline,
  noteEntry,
  personCard,
  taskRow,
  threadSummary,
} from './shape.js';

describe('fullName', () => {
  it('joins first and last, falls back to preferred, then email', () => {
    expect(fullName({ first_name: 'Marja', last_name: 'de Vries' })).toBe('Marja de Vries');
    expect(fullName({ preferred_name: 'Maz' })).toBe('Maz');
    expect(fullName({ email: 'm@example.org' })).toBe('m@example.org');
    expect(fullName(null)).toBeNull();
  });
});

describe('the wall: what never crosses', () => {
  it('a note entry carries no body', () => {
    const e = noteEntry({
      id: 'n1',
      body: 'She said the board is nervous about the merger.',
      kind: 'meeting',
      happened_at: '2026-09-10T10:00:00Z',
      follow_up_at: '2026-09-20',
    });
    expect(JSON.stringify(e)).not.toContain('nervous');
    expect(e).toMatchObject({ kind: 'note', type: 'meeting', subject: null, follow_up_at: '2026-09-20' });
  });

  it('an engagement carries no content', () => {
    const g = engagementRow({
      id: 'g1',
      type: 'message',
      title: 'Welcome',
      content: '<p>Dear all, here is the Zoom link…</p>',
      scheduled_at: '2026-09-18T08:00:00Z',
    });
    expect(JSON.stringify(g)).not.toContain('Zoom');
    expect(g.title).toBe('Welcome');
  });

  it('a person card is an allow-list, not a spread', () => {
    const c = personCard({
      id: 'p1',
      first_name: 'Daniel',
      last_name: 'K',
      email: 'd@example.org',
      answers: { dietary: 'vegan' },
      stripe_customer_id: 'cus_123',
    });
    expect(c).not.toHaveProperty('answers');
    expect(c).not.toHaveProperty('stripe_customer_id');
    expect(c.name).toBe('Daniel K');
  });

  it('an enrolment carries no answers or money fields', () => {
    const e = enrolmentRow({
      id: 'e1',
      status: 'invited',
      person: [{ id: 'p1', first_name: 'A', last_name: 'B', email: 'a@b.c' }],
      answers: { why: 'because' },
      amount_cents: 1200,
    });
    expect(e).not.toHaveProperty('answers');
    expect(e).not.toHaveProperty('amount_cents');
    expect(e.name).toBe('A B');
  });
});

describe('timeline', () => {
  it('merges three sources newest first and honours the limit', () => {
    const entries = [
      activityEntry({ occurred_at: '2026-09-01T00:00:00Z', type: 'enrolled', subject: 'Athens', app: { name: 'The Thread' } }),
      noteEntry({ happened_at: '2026-09-12T00:00:00Z', kind: 'call' }),
      flowRunEntry({ entered_at: '2026-09-05T00:00:00Z', status: 'active', flow: { name: 'Onboarding' }, step: { name: 'Intake' } }),
    ];
    const t = mergeTimeline(entries, 2);
    expect(t.map((e) => e.kind)).toEqual(['note', 'flow_run']);
    expect(entries[0]?.app).toBe('The Thread');
  });
});

describe('threads and tasks', () => {
  it('reads programme fields whether flat or nested', () => {
    expect(threadSummary({ id: 't', program_id: 'p', title: 'Athens', status: 'active' }).title).toBe('Athens');
    expect(threadSummary({ id: 't', program: { id: 'p', title: 'Athens', status: 'active' } })).toMatchObject({
      program_id: 'p',
      title: 'Athens',
    });
  });

  it('names the person and the process on a task', () => {
    const t = taskRow({
      id: 'k',
      title: 'Send deck',
      status: 'open',
      contact: { first_name: 'Marja', last_name: 'V' },
      run: { subject_label: 'Q4 proposal', organisation: { name: 'EBBF' } },
    });
    expect(t).toMatchObject({ person: 'Marja V', about: 'Q4 proposal', organisation: 'EBBF' });
  });
});
