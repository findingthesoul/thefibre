import { describe, expect, it } from 'vitest';
import { formatMinutes } from './effort-format';

describe('formatMinutes', () => {
  it('says minutes under an hour exactly', () => {
    expect(formatMinutes(0, 'en')).toBe('0 min');
    expect(formatMinutes(55, 'en')).toBe('55 min');
  });

  it('says whole hours without a minutes part', () => {
    expect(formatMinutes(120, 'en')).toBe('2 h');
  });

  it('says hours and minutes together', () => {
    expect(formatMinutes(90, 'en')).toBe('1 h 30 min');
  });

  it('rounds to five minutes above an hour, never claiming a precision nobody measured', () => {
    expect(formatMinutes(197, 'en')).toBe('3 h 15 min');
  });

  it('does not round below an hour', () => {
    // The twin of the rounding case: 57 stays 57.
    expect(formatMinutes(57, 'en')).toBe('57 min');
  });

  it('carries into the next hour when rounding reaches it', () => {
    expect(formatMinutes(118, 'en')).toBe('2 h');
  });
});
