import { describe, expect, it } from 'vitest';
import { DEFAULT_MINUTES, effortFor, isEffortKind, minutesPerUnit, taskKind } from './effort.js';

describe('defaults and overrides', () => {
  it('uses the shipped default when the workspace has not changed it', () => {
    expect(minutesPerUnit('follow_up')).toBe(DEFAULT_MINUTES.follow_up);
  });

  it("uses the workspace's own number when it has one", () => {
    // The twin of the case above.
    expect(minutesPerUnit('follow_up', { follow_up: 40 })).toBe(40);
  });

  it('accepts zero as a real answer, not as missing', () => {
    // "This takes no time for us" is a legitimate override; a truthiness
    // check would quietly put the default back.
    expect(minutesPerUnit('meeting_brief', { meeting_brief: 0 })).toBe(0);
  });

  it('ignores a nonsense override rather than trusting it', () => {
    expect(minutesPerUnit('task', { task: -5 })).toBe(DEFAULT_MINUTES.task);
    expect(minutesPerUnit('task', { task: Number.NaN })).toBe(DEFAULT_MINUTES.task);
  });
});

describe('per-person preparation scales with the people', () => {
  it('counts four unreached people as four conversations', () => {
    expect(effortFor('thread_unreached', 4, { thread_unreached: 5 })).toBe(20);
  });

  it('does not multiply a kind that is one piece of work', () => {
    // A meeting brief with a count on it is still one brief.
    expect(effortFor('meeting_brief', 4, { meeting_brief: 10 })).toBe(10);
  });

  it('counts a per-person row with no count once, never as nothing', () => {
    expect(effortFor('thread_unpaid', null, { thread_unpaid: 5 })).toBe(5);
    expect(effortFor('thread_unpaid', 0, { thread_unpaid: 5 })).toBe(5);
  });
});

describe('the kind of a task', () => {
  const plain = { step_default_task_id: null, gate_task_id: null };

  it('knows a follow-up by the note that made it, not by its title', () => {
    expect(taskKind(plain, true)).toBe('follow_up');
  });

  it('calls a task from a journey step a flow step', () => {
    expect(taskKind({ step_default_task_id: 'x', gate_task_id: null }, false)).toBe('flow_step');
    expect(taskKind({ step_default_task_id: null, gate_task_id: 'y' }, false)).toBe('flow_step');
  });

  it('calls anything else a task', () => {
    expect(taskKind(plain, false)).toBe('task');
  });
});

it('recognises only the kinds it has defaults for', () => {
  expect(isEffortKind('follow_up')).toBe(true);
  expect(isEffortKind('lunch')).toBe(false);
});
