// The ONE env-file reader for apps/api/scripts.
//
// Every script here talks to a Supabase project, and until 2026-09-14 each
// of the nineteen carried its own copy of the parser — ten in one form, nine
// in slightly different ones, and at least one (`split('=', 2)`) that
// silently truncated any value containing a second `=`. One reader, one set
// of rules:
//
//   - FIBRE_ENV_FILE picks the file, relative to apps/api (default `.env`,
//     so a bare run targets whatever that file points at — for most
//     machines, production). `.env.staging` is the staging twin.
//   - A variable already in the process wins over the file, so
//     `SUPABASE_SERVICE_ROLE_KEY=… node scripts/x.mjs` still works.
//   - The path that was read is exposed, so a script can SAY which project
//     it is about to touch. Pointing at production by accident should be
//     visible, not silent.
//
// Values are split at the FIRST `=`; surrounding double quotes are dropped;
// blank lines and `#` comments are ignored. That is the whole grammar the
// files use.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @returns {{ file: string, env: Record<string,string> }} */
export function loadEnv(name = process.env.FIBRE_ENV_FILE ?? '.env') {
  const file = resolve(API_ROOT, name);
  let raw;
  try {
    raw = readFileSync(file, 'utf-8');
  } catch {
    throw new Error(
      `Env file not found: ${file}\n` +
        `Set FIBRE_ENV_FILE to pick a different one (e.g. .env.staging).`,
    );
  }
  const fromFile = Object.fromEntries(
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1')];
      }),
  );
  return { file, env: { ...fromFile, ...pickDefined(process.env, Object.keys(fromFile)) } };
}

function pickDefined(source, keys) {
  const out = {};
  for (const k of keys) if (source[k] !== undefined && source[k] !== '') out[k] = source[k];
  return out;
}

/**
 * Supabase URL + keys, or a clear failure naming the file that lacked them.
 * `requireService` is on by default because almost every script here writes
 * or reads through RLS; pass false for a probe that must run as anon only.
 */
export function supabaseEnv({ requireService = true } = {}) {
  const { file, env } = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    requireService && !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`${file} is missing ${missing.join(', ')}.`);
  }
  return { file, env, url, anonKey, serviceKey, projectRef: projectRefOf(url) };
}

/** `https://abcd.supabase.co` → `abcd`; used to announce the target. */
export function projectRefOf(url) {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return url;
  }
}
