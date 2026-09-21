// Encrypting a secret at rest that the API must later SEND, not merely compare.
//
// Hashes cover app keys and refresh-token lookups (the API only compares
// them). Two things cannot be hashed: a workspace's own model key, which the
// API has to present to Anthropic, and the dedicated Supabase refresh token
// behind an MCP grant, which the API has to present to Supabase. Both come
// through here. AES-256-GCM.
//
// Which secret the key is derived from — decided 2026-09-15 after review:
//   - ASSISTANT_KEY_SECRET, a Fly secret of its own, when it is set. A
//     credential-at-rest secret and the SSO signing secret have unrelated
//     rotation schedules and unrelated blast radii.
//   - SSO_INTERNAL_SECRET only as a fallback, so a deployment works before the
//     dedicated secret exists.
// The first byte of the packed value says which one was used (a key id), so
// a later rotation can re-encrypt row by row instead of asking every person
// to connect again. Rotating a secret that rows still depend on makes those
// rows unreadable; callers treat that as "no credential" and ask for it again.
//
// Born as lib/assistant/secret.ts (v0.78.0/v0.78.1); moved here in v0.83.0
// when the MCP grants needed the same box. That module re-exports this one.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Key ids. Never reuse a number for a different secret. */
const KID_SSO_FALLBACK = 0;
const KID_DEDICATED = 1;

function rootFor(kid: number): string {
  const name = kid === KID_DEDICATED ? 'ASSISTANT_KEY_SECRET' : 'SSO_INTERNAL_SECRET';
  const root = process.env[name];
  if (!root || root.length < 16) throw new Error(`${name} is not set — cannot protect a stored credential`);
  return root;
}

function derivedKey(kid: number): Buffer {
  return Buffer.from(hkdfSync('sha256', rootFor(kid), 'thefibre-assistant', `workspace-model-key:${kid}`, 32));
}

/** The key id new ciphertext is written under: dedicated when it exists. */
export function currentKid(): number {
  const dedicated = process.env.ASSISTANT_KEY_SECRET;
  return dedicated && dedicated.length >= 16 ? KID_DEDICATED : KID_SSO_FALLBACK;
}

/** base64( kid || iv || ciphertext || tag ) */
export function encryptSecret(plain: string, kid: number = currentKid()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, derivedKey(kid), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([kid]), iv, body, cipher.getAuthTag()]).toString('base64');
}

export function decryptSecret(packed: string): string {
  const buf = Buffer.from(packed, 'base64');
  if (buf.length < 1 + IV_BYTES + TAG_BYTES + 1) throw new Error('ciphertext too short');
  const kid = buf[0]!;
  const iv = buf.subarray(1, 1 + IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const body = buf.subarray(1 + IV_BYTES, buf.length - TAG_BYTES);
  const decipher = createDecipheriv(ALG, derivedKey(kid), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** Which key id a stored value was written under — for a rotation pass. */
export function kidOf(packed: string): number {
  return Buffer.from(packed, 'base64')[0] ?? -1;
}

/** What a settings page shows: the last four characters, nothing else. */
export function hintOf(key: string): string {
  return key.slice(-4);
}
