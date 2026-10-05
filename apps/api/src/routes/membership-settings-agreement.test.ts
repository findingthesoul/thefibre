// The settings schema and the screens that post to it must agree.
//
// PutSettings is .strict() since 2026-10-05, which turns a field the API does
// not know into a 400 instead of a silent discard. That is the right trade —
// a save that reports success and writes nothing cost real time — but it
// moves the failure from "quietly wrong" to "loudly refused", and a loud
// refusal in front of an admin is only an improvement if our own screens
// never trigger it.
//
// So this asserts the agreement directly: every key the Membership app's
// server actions send is a key the schema accepts. Each side passes its own
// tests while disagreeing; only a test that reads both catches the drift.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PutSettings } from './membership.js';

/** Every `foo:` key inside the settings server actions' putSettings calls. */
function keysTheAppSends(): string[] {
  const src = readFileSync(
    resolve(import.meta.dirname, '../../../membership/app/(app)/settings/actions.ts'),
    'utf8',
  );
  const found = new Set<string>();
  // putSettings({ ... }) and the input objects handed straight to it.
  for (const m of src.matchAll(/\b(directory_\w+|circle_\w+|google_\w+|join_page|locale|fibre_seat_mode|allow_billed_seats)\b/g)) {
    found.add(m[1]);
  }
  return [...found];
}

describe('the settings screens and the settings schema', () => {
  it('accepts every field the app actually sends', () => {
    const shape = Object.keys(PutSettings.shape);
    const unknown = keysTheAppSends().filter((k) => !shape.includes(k));
    expect(
      unknown,
      'these keys are sent by apps/membership but PutSettings is strict and would 400 on them',
    ).toEqual([]);
  });

  it('refuses a field it does not know, instead of dropping it', () => {
    const r = PutSettings.safeParse({ directory_enabled: true, not_a_real_field: 1 });
    expect(r.success, 'an unknown key must be refused, not stripped').toBe(false);
  });

  it('still accepts a known partial save', () => {
    expect(PutSettings.safeParse({ directory_enabled: true }).success).toBe(true);
  });
});
