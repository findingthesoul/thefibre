import { describe, expect, it } from 'vitest';
import { isUuid } from './ids.js';

describe('isUuid', () => {
  it('accepts a uuid, in either case', () => {
    expect(isUuid('04dba420-13b5-45b2-8e4f-9219d28b00c5')).toBe(true);
    expect(isUuid('04DBA420-13B5-45B2-8E4F-9219D28B00C5')).toBe(true);
  });

  // Each of these reached a uuid column through a public query parameter and
  // came back as a 500 carrying the Postgres message.
  it('rejects the things that actually arrive instead', () => {
    for (const bad of ['default', '', ' ', 'int-public-fixtures', '04dba420', null, undefined]) {
      expect(isUuid(bad), String(bad)).toBe(false);
    }
  });

  it('is anchored — a uuid inside a longer string is not one', () => {
    expect(isUuid(' 04dba420-13b5-45b2-8e4f-9219d28b00c5')).toBe(false);
    expect(isUuid('04dba420-13b5-45b2-8e4f-9219d28b00c5 or 1=1')).toBe(false);
  });
});
