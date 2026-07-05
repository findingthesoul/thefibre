// Connections SPoT — Google Calendar token + personal meeting room are
// user-level platform data (user_connection, service-role only; the token
// is a credential and must never be readable through PostgREST). The old
// meet_host columns remain READ FALLBACKS for rows written before
// v0.13.107; writes go through the save* helpers here, which clear the
// fallback so a later disconnect can't be resurrected by it.
// Same pattern as payment-accounts.ts.

import { adminClient } from '../db.js';

/** The user's Google refresh token: user_connection → meet_host. */
export async function userGoogleToken(
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data: c } = await adminClient
    .from('user_connection')
    .select('google_refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (c?.google_refresh_token) return c.google_refresh_token;
  const { data: m } = await adminClient
    .from('meet_host')
    .select('google_refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  return m?.google_refresh_token ?? null;
}

/** Same, addressed by meet_host id (booking flows carry host_id). */
export async function hostGoogleToken(
  hostId: string | null | undefined,
): Promise<string | null> {
  if (!hostId) return null;
  const { data: h } = await adminClient
    .from('meet_host')
    .select('user_id, google_refresh_token')
    .eq('id', hostId)
    .maybeSingle();
  if (!h) return null;
  const { data: c } = await adminClient
    .from('user_connection')
    .select('google_refresh_token')
    .eq('user_id', h.user_id)
    .maybeSingle();
  return c?.google_refresh_token ?? h.google_refresh_token ?? null;
}

/** Personal meeting room URL: user_connection → meet_host. */
export async function userPersonalRoom(
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data: c } = await adminClient
    .from('user_connection')
    .select('personal_room_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (c?.personal_room_url) return c.personal_room_url;
  const { data: m } = await adminClient
    .from('meet_host')
    .select('personal_room_url')
    .eq('user_id', userId)
    .maybeSingle();
  return m?.personal_room_url ?? null;
}

/** Platform write + clear the meet_host fallback (anti-resurrection). */
export async function saveGoogleToken(
  userId: string,
  token: string | null,
): Promise<{ error: string | null }> {
  const { error } = await adminClient
    .from('user_connection')
    .upsert({ user_id: userId, google_refresh_token: token }, { onConflict: 'user_id' });
  if (error) return { error: error.message };
  await adminClient
    .from('meet_host')
    .update({ google_refresh_token: null })
    .eq('user_id', userId);
  return { error: null };
}

/** Platform write + clear the meet_host fallback (anti-resurrection). */
export async function savePersonalRoom(
  userId: string,
  url: string | null,
): Promise<{ error: string | null }> {
  const { error } = await adminClient
    .from('user_connection')
    .upsert({ user_id: userId, personal_room_url: url }, { onConflict: 'user_id' });
  if (error) return { error: error.message };
  await adminClient
    .from('meet_host')
    .update({ personal_room_url: null })
    .eq('user_id', userId);
  return { error: null };
}
