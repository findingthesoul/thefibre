// Operator-level switches stored as data (platform_setting), so flipping one
// is a click on /admin/access-requests, not a deploy. Service-role reads with
// a short cache — a toggle should take effect while the operator is still
// looking at the screen, same reasoning as the plan cache.

import { adminClient } from '../db.js';

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const { data, error } = await adminClient
    .from('platform_setting')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.warn('[platform-settings] read failed, using fallback', key, error.message);
    return fallback;
  }
  const value = (data?.value ?? fallback) as T;
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const { error } = await adminClient
    .from('platform_setting')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`platform_setting write failed: ${error.message}`);
  cache.set(key, { at: Date.now(), value });
}

/** The signup door: true = self-serve (approve instantly), false = invited. */
export async function autoApproveSignups(): Promise<boolean> {
  return getSetting<boolean>('auto_approve_signups', true);
}
