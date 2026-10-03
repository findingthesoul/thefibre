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

/**
 * Write the rotated token. `token: null` disconnects.
 *
 * `zoomUserId` is Zoom's own id for the account (20260914220000) — the key
 * Zoom's deauthorization arrives with. Pass it at connect time; token
 * rotations leave it alone. Disconnecting clears it with everything else.
 */
export async function saveZoomConnection(
  userId: string,
  token: string | null,
  accountEmail?: string | null,
  zoomUserId?: string | null,
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = { user_id: userId, zoom_refresh_token: token };
  if (token === null) {
    patch.zoom_account_email = null;
    patch.zoom_user_id = null;
  } else {
    if (accountEmail !== undefined) patch.zoom_account_email = accountEmail;
    if (zoomUserId !== undefined) patch.zoom_user_id = zoomUserId;
  }
  const { error } = await adminClient
    .from('user_connection')
    .upsert(patch, { onConflict: 'user_id' });
  return { error: error?.message ?? null };
}

/**
 * Zoom says this Zoom user removed the app: delete what we hold for them.
 *
 * Marketplace review requires the data actually be gone, not the event
 * acknowledged. So this clears the refresh token, the account email and the
 * Zoom id on EVERY row carrying that id — one human may have connected the
 * same Zoom account from more than one workspace — and returns the platform
 * user ids it cleared, so the caller can drop their cached access tokens.
 *
 * Meeting links already written onto past bookings stay: they belong to the
 * booking, not to the Zoom connection, and a host's booking history does not
 * vanish because they uninstalled an integration.
 */
export async function forgetZoomUser(
  zoomUserId: string,
): Promise<{ clearedUserIds: string[]; error: string | null }> {
  const { data, error } = await adminClient
    .from('user_connection')
    .update({ zoom_refresh_token: null, zoom_account_email: null, zoom_user_id: null })
    .eq('zoom_user_id', zoomUserId)
    .select('user_id');
  return {
    clearedUserIds: (data ?? []).map((r) => r.user_id as string),
    error: error?.message ?? null,
  };
}

// ---------------------------------------------------------------------------
// Microsoft Teams. Same SPoT reasoning as Zoom: the refresh token is a
// credential, so it lives on user_connection (service-role only) and every
// reader comes through here. No meet_host fallback — it never existed.
//
// Every write here touches ONLY the teams_* columns. personal_room_url and the
// Zoom and Google columns are other connections' state; an upsert that named
// them would clobber a person's other integrations (teams.test.ts pins this).
// ---------------------------------------------------------------------------

/** The user's Microsoft refresh token, or null when they haven't connected. */
export async function userTeamsToken(
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await adminClient
    .from('user_connection')
    .select('teams_refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.teams_refresh_token ?? null;
}

/** Which Microsoft account is wired up (for the settings card). */
export async function userTeamsAccount(
  userId: string | null | undefined,
): Promise<{ connected: boolean; email: string | null }> {
  if (!userId) return { connected: false, email: null };
  const { data } = await adminClient
    .from('user_connection')
    .select('teams_refresh_token, teams_account_email')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    connected: !!data?.teams_refresh_token,
    email: data?.teams_account_email ?? null,
  };
}

/**
 * Write the rotated token. `token: null` disconnects and clears the account
 * email and Graph id with it. Pass `accountEmail` / `teamsUserId` at connect
 * time; token rotations leave them alone.
 */
export async function saveTeamsConnection(
  userId: string,
  token: string | null,
  accountEmail?: string | null,
  teamsUserId?: string | null,
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = { user_id: userId, teams_refresh_token: token };
  if (token === null) {
    patch.teams_account_email = null;
    patch.teams_user_id = null;
  } else {
    if (accountEmail !== undefined) patch.teams_account_email = accountEmail;
    if (teamsUserId !== undefined) patch.teams_user_id = teamsUserId;
  }
  const { error } = await adminClient
    .from('user_connection')
    .upsert(patch, { onConflict: 'user_id' });
  return { error: error?.message ?? null };
}
