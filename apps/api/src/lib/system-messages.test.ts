import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Sjoerd, 2026-09-25, after duplicating a thread into "fellowship year
// agenda": "It auto copies the enrolment message. I CAN'T DELETE ONE."
//
// Two faults met. Each is a single line, and each is the kind that a
// typecheck cannot see because nothing is missing — a column is simply not
// named, and a question is simply the wrong question.
//
//   1. the duplicate's engagement INSERT names its columns explicitly and
//      never named `system_role`, so the copied enrolment message arrived as
//      an ordinary message and a second one was seeded beside it;
//   2. `ensureSystemEngagements` asked "is this row here?" rather than "did
//      we already give it to you?", and runs on every editor load — so a
//      deleted system message came straight back.
//
// What made it expensive rather than annoying: the ticket is attached ONLY to
// the row carrying `enrolment_confirmed`. Two identical rows, no marker, and
// deleting the wrong one leaves every enrolling participant receiving an
// email with no ticket in it.
//
// These read the source. The behaviour lives in a Supabase call chain that a
// unit test cannot exercise without standing up the database, and what needs
// guarding is the ABSENCE of a line — a column left out of a list, a check
// left off a branch. An integration test would prove today's behaviour;
// only this fails when someone tidies the list.

const src = readFileSync(
  fileURLToPath(new URL('../routes/thread.ts', import.meta.url)),
  'utf8',
);

/** The engagement insert inside POST /threads/:id/duplicate. */
const duplicateInsert = (() => {
  const at = src.indexOf("threadRoutes.post('/threads/:id/duplicate'");
  expect(at, 'the duplicate route still exists').toBeGreaterThan(-1);
  const from = src.indexOf("from('thread_engagement').insert({", at);
  return src.slice(from, src.indexOf('.select(', from));
})();

const ensureFn = (() => {
  const at = src.indexOf('export async function ensureSystemEngagements');
  expect(at, 'ensureSystemEngagements still exists').toBeGreaterThan(-1);
  return src.slice(at, src.indexOf('\n}', at));
})();

describe('duplicating a thread keeps its system messages system', () => {
  it('copies system_role — without it the copy is an ordinary message', () => {
    expect(duplicateInsert).toMatch(/system_role:\s*e\.system_role/);
  });

  it('still copies the columns earlier bugs added', () => {
    // daily_schedule was missed once already and a duplicated two-day event
    // lost its per-day times. Same list, same failure shape.
    for (const col of ['daily_schedule', 'trigger_kind', 'content', 'position']) {
      expect(duplicateInsert, `${col} missing from the clone`).toContain(`${col}:`);
    }
  });
});

describe('a system message that is deleted stays deleted', () => {
  it('reads what was already seeded, not only what exists', () => {
    expect(ensureFn).toContain('system_messages_seeded');
  });

  it('both roles are guarded by that record, not by presence alone', () => {
    expect(ensureFn).toMatch(/!skip\('enrolment_confirmed'\)/);
    expect(ensureFn).toMatch(/!skip\('enrolment_received'\)/);
    // The old shape. If either comes back, deletion stops sticking.
    expect(ensureFn).not.toMatch(/!have\.has\('enrolment_(confirmed|received)'\)/);
  });

  it('records the roles it seeded, or deletion never becomes final', () => {
    expect(ensureFn).toMatch(/system_messages_seeded:\s*\[/);
  });

  it('does not record a role whose insert failed', () => {
    // Recording on failure is worse than not recording: the message would
    // never arrive AND would never be retried.
    const tail = ensureFn.slice(ensureFn.indexOf('could not seed system messages'));
    expect(tail.slice(0, 200)).toContain('return;');
  });
});

describe('the organiser can tell which message carries the ticket', () => {
  it('the ticket is still attached only to enrolment_confirmed', () => {
    expect(src).toMatch(/system_role === 'enrolment_confirmed'/);
  });

  it('and the timeline marks that row', () => {
    const timeline = readFileSync(
      fileURLToPath(new URL('../../../thread/app/(app)/threads/[id]/timeline.tsx', import.meta.url)),
      'utf8',
    );
    expect(timeline).toMatch(/e\.system_role &&/);
    expect(timeline).toContain('sends_the_ticket');
  });
});
