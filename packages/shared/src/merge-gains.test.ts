import { describe, it, expect } from 'vitest';
import { mergeGains } from './merge-gains.js';

describe('mergeGains', () => {
  it('names the fields when the preview answered with some', () => {
    expect(mergeGains(['phone', 'city'])).toEqual({ kind: 'list', fields: ['phone', 'city'] });
  });

  // The two that a falsy check cannot tell apart, which is the bug this
  // module exists to prevent. They mean opposite things: one is a finding
  // about the data, the other is the absence of a finding.
  it('distinguishes "nothing moves" from "nobody asked"', () => {
    expect(mergeGains([]).kind).toBe('none');
    expect(mergeGains(undefined).kind).toBe('unknown');
    expect(mergeGains(null).kind).toBe('unknown');
    expect(mergeGains([]).kind).not.toBe(mergeGains(undefined).kind);
  });

  // The exact shape of the staging failure on 2026-10-04: the API had not
  // been deployed with the preview, so the field was absent on every record,
  // and both cards announced that they gained nothing.
  it('an API that does not send the field is unknown, never "none"', () => {
    const fromOlderApi = (JSON.parse('{"a_gains":null}') as { a_gains?: string[] }).a_gains;
    expect(mergeGains(fromOlderApi).kind).toBe('unknown');
    const missingAltogether = (JSON.parse('{}') as { a_gains?: string[] }).a_gains;
    expect(mergeGains(missingAltogether).kind).toBe('unknown');
  });
});
