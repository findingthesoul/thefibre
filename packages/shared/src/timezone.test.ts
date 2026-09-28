import { describe, it, expect } from 'vitest';
import { isTimeZone, resolveTimeZone, DEFAULT_TIME_ZONE } from './timezone.js';

describe('isTimeZone', () => {
  it('accepts real IANA zones', () => {
    for (const tz of ['Europe/Amsterdam', 'Europe/Athens', 'UTC', 'America/New_York']) {
      expect(isTimeZone(tz)).toBe(true);
    }
  });

  // The actual value that took production down on 2026-09-28. Athens is
  // 'Europe/Athens'; 'Athenes/Greece' is a person's guess at the format.
  it('rejects the invented zone that crashed The Thread', () => {
    expect(isTimeZone('Athenes/Greece')).toBe(false);
  });

  it('rejects empty, blank and non-string values', () => {
    for (const v of ['', '   ', null, undefined, 42, {}, []]) {
      expect(isTimeZone(v)).toBe(false);
    }
  });
});

describe('resolveTimeZone', () => {
  it('keeps a valid zone', () => {
    expect(resolveTimeZone('Europe/Athens')).toBe('Europe/Athens');
  });

  it('falls back instead of throwing on a bad one', () => {
    expect(resolveTimeZone('Athenes/Greece')).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
  });

  it('honours a caller-supplied fallback', () => {
    expect(resolveTimeZone(null, 'Europe/Athens')).toBe('Europe/Athens');
  });

  it('refuses to hand back a bad fallback either', () => {
    expect(resolveTimeZone('Athenes/Greece', 'Also/Nonsense')).toBe(DEFAULT_TIME_ZONE);
  });

  // The guarantee the render path depends on: whatever is in the column,
  // formatting must not throw. This is the assertion that would have caught
  // the outage.
  it('its result is always safe to hand to Intl', () => {
    for (const v of ['Athenes/Greece', '', null, undefined, 'Europe/Athens']) {
      const tz = resolveTimeZone(v as string | null | undefined);
      expect(() => new Date().toLocaleDateString('en-CA', { timeZone: tz })).not.toThrow();
    }
  });
});
