// A workspace's own reply-to must survive a host who has no email.
//
// Every booking mail is built as `{ ...sender, to, subject, …, replyTo }`,
// where `sender` comes from meetSender() and may already carry the
// WORKSPACE's reply-to from its brand. Writing `replyTo: host.email ??
// undefined` after that spread does not fall back to the workspace value —
// it overwrites it with undefined. So a host without an email address turned
// a branded workspace reply-to into none at all, on nine sends.
//
// Found in the stress chat's mail audit, 2026-10-06. The fix is to make the
// spread's own value the fallback: `?? sender.replyTo`.
//
// This reads the source across the whole API rather than one file, because
// the pattern is a habit, not a place: the next person writing a mail will
// copy whichever call they are nearest.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(new URL('.', import.meta.url).pathname, '..', '..');

function everyTsFile(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return everyTsFile(full);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [full] : [];
  });
}

describe('reply-to never overwrites the sender with nothing', () => {
  it('no mail sets replyTo to undefined after spreading a sender', () => {
    // Report what was FOUND: the file and the line, so whoever reintroduces
    // it is told where rather than that a number changed.
    const offenders: string[] = [];
    for (const file of everyTsFile(srcRoot)) {
      const rel = file.slice(srcRoot.length + 1);
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/replyTo:\s*.*\?\?\s*undefined/.test(line) || /replyTo:\s*undefined/.test(line)) {
            offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
          }
        });
    }
    expect(
      offenders,
      'replyTo falls back to undefined, which wipes the workspace reply-to the sender spread in — use `?? sender.replyTo`',
    ).toEqual([]);
  });
});
