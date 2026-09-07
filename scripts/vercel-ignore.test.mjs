// The build-skip guard — it decides whether Vercel builds an app, so a
// wrong "skip" ships a stale deploy and a wrong base misses commits in a
// multi-commit push. The safety posture is: any doubt → build.

import { describe, expect, it } from 'vitest';
import { changePaths, pickBase, validApp } from './vercel-ignore.mjs';

describe('validApp', () => {
  it('accepts plain app folder names, rejects everything else', () => {
    expect(validApp('meet')).toBe(true);
    expect(validApp('membership')).toBe(true);
    expect(validApp(undefined)).toBe(false);
    expect(validApp('')).toBe(false);
    expect(validApp('meet;rm -rf')).toBe(false);
    expect(validApp('../web')).toBe(false);
  });
});

describe('pickBase', () => {
  const probe = (commitExists, hasParent) => ({
    commitExists: () => commitExists,
    hasParent: () => hasParent,
  });

  it('prefers the previously deployed sha when it exists in the clone', () => {
    expect(pickBase('abc1234', probe(true, true))).toBe('abc1234');
  });

  it('falls back to HEAD^ when the sha is missing from the (shallow) clone', () => {
    expect(pickBase('abc1234', probe(false, true))).toBe('HEAD^');
  });

  it('falls back to HEAD^ when the sha is absent or malformed', () => {
    expect(pickBase(undefined, probe(true, true))).toBe('HEAD^');
    expect(pickBase('not-a-sha!', probe(true, true))).toBe('HEAD^');
  });

  it('no usable base at all → null (caller builds to be safe)', () => {
    expect(pickBase(undefined, probe(true, false))).toBe(null);
    expect(pickBase('abc1234', probe(false, false))).toBe(null);
  });
});

describe('changePaths', () => {
  const paths = changePaths('meet');

  it('watches the app folder and shared, excluding only their package.json', () => {
    expect(paths).toContain('apps/meet');
    expect(paths).toContain(':(exclude)apps/meet/package.json');
    expect(paths).toContain('packages/shared');
    expect(paths).toContain(':(exclude)packages/shared/package.json');
  });

  it('includes the lockfile — real dependency changes always rebuild', () => {
    expect(paths).toContain('pnpm-lock.yaml');
    expect(paths).toContain('pnpm-workspace.yaml');
  });
});
