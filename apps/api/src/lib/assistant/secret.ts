// Encrypting a workspace's own model key at rest.
//
// An app key can be stored as a hash because the API only ever compares it.
// A workspace's Anthropic key cannot: the API has to SEND it, so the plaintext
// must be recoverable — by this process and nothing else. AES-256-GCM with a
// key derived from SSO_INTERNAL_SECRET (already on every API deployment; it
// signs the SSO hop and the OAuth provider's tokens). Rotating that secret
// makes stored keys unreadable, which surfaces as "connect your key again" in
// Settings — the right failure for a credential.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function derivedKey(): Buffer {
  const root = process.env.SSO_INTERNAL_SECRET;
  if (!root || root.length < 16) {
    throw new Error('SSO_INTERNAL_SECRET is not set — cannot protect a workspace model key');
  }
  return Buffer.from(hkdfSync('sha256', root, 'thefibre-assistant', 'workspace-model-key', 32));
}

/** base64( iv || ciphertext || tag ) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, derivedKey(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64');
}

export function decryptSecret(packed: string): string {
  const buf = Buffer.from(packed, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES + 1) throw new Error('ciphertext too short');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const body = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = createDecipheriv(ALG, derivedKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** What Settings shows: the last four characters, nothing else. */
export function hintOf(key: string): string {
  return key.slice(-4);
}
