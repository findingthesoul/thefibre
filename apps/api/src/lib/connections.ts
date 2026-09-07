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

// ---------------------------------------------------------------------------
// Zoom (v0.59.0). Same SPoT reasoning as Google: the refresh token is a
// credential, so it lives on user_connection (service-role only) and every
// reader comes through here. No meet_host fallback — the column never
// existed there, and it must not start now.
// ---------------------------------------------------------------------------

/** The user's Zoom refresh token, or null when they haven't connected. */
export async function userZoomToken(
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await adminClient
    .from('user_connection')
    .select('zoom_refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.zoom_refresh_token ?? null;
}

/** Which Zoom account is wired up (for the settings card). */
export async function userZoomAccount(
  userId: string | null | undefined,
): Promise<{ connected: boolean; email: string | null }> {
  if (!userId) return { connected: false, email: null };
  const { data } = await adminClient
    .from('user_connection')
    .select('zoom_refresh_token, zoom_account_email')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    connected: !!data?.zoom_refresh_token,
    email: data?.zoom_account_email ?? null,
  };
}

/** Same, addressed by meet_host id (booking flows carry host_id). */
export async function hostZoomUserId(
  hostId: string | null | undefined,
): Promise<string | null> {
  if (!hostId) return null;
  const { data } = await adminClient
    .from('meet_host')
    .select('user_id')
    .eq('id', hostId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/** Write the rotated token. `token: null` disconnects. */
export async function saveZoomConnection(
  userId: string,
  token: string | null,
  accountEmail?: string | null,
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = { user_id: userId, zoom_refresh_token: token };
  if (token === null) patch.zoom_account_email = null;
  else if (accountEmail !== undefined) patch.zoom_account_email = accountEmail;
  const { error } = await adminClient
    .from('user_connection')
    .upsert(patch, { onConflict: 'user_id' });
  return { error: error?.message ?? null };
}
