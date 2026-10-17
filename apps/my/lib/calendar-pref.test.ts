import { describe, expect, it } from 'vitest';
import { CALENDAR_CHOICE_KEY, readCalendarChoice, writeCalendarChoice } from './calendar-pref';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

const blocked = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('the remembered calendar', () => {
  it('reads back what was written', () => {
    const s = memory();
    writeCalendarChoice('google', s);
    expect(s.m.get(CALENDAR_CHOICE_KEY)).toBe('google');
    expect(readCalendarChoice(s)).toBe('google');
  });

  it('is nothing until something is chosen', () => {
    expect(readCalendarChoice(memory())).toBeNull();
  });

  it('ignores a value it does not know', () => {
    const s = memory();
    s.setItem(CALENDAR_CHOICE_KEY, 'yahoo');
    expect(readCalendarChoice(s)).toBeNull();
  });

  it('survives blocked storage: reads nothing, writes nothing, throws nothing', () => {
    expect(readCalendarChoice(blocked)).toBeNull();
    expect(() => writeCalendarChoice('outlook', blocked)).not.toThrow();
    expect(readCalendarChoice(null)).toBeNull();
  });
});
