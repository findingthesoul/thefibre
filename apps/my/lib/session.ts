// One portal fetch per request, shared by the layout and whichever tab is
// rendering. `cache()` dedupes within a single render pass, so four tabs
// reading the same payload cost one call, not four.
//
// Every page here asks the same two questions — "is someone signed in" and
// "what do they have" — and the answer to the first is the answer to the
// second being null. Keeping that in one place is what stops each tab
// inventing its own signed-out branch.

import { cache } from 'react';
import { serverSupabase } from './supabase/server';
import {
  fetchCalendarStatus,
  fetchDirectoryChoices,
  fetchDirectoryMembers,
  fetchErasure,
  type DirectoryChoice,
  type DirectoryList,
  fetchInvoices,
  fetchPortal,
  fetchProfile,
  PortalApiError,
  type CalendarStatus,
  type ErasurePicture,
  type MyProfile,
  type Portal,
  type PortalInvoice,
} from './portal-api';

export type Session = { token: string; portal: Portal };

/** Just the access token, without the portal payload.
 *
 *  /me/portal is the heaviest call this app makes (~1.5s on staging), and a
 *  page that only needs to ask the API its own question used to wait for it
 *  before asking — the Members list was a 1.5s portal fetch followed by its
 *  own calls, end to end. With the token alone a page starts its calls at
 *  once, and the portal (which the layout still needs, for the nav) runs
 *  beside them instead of in front of them.
 *
 *  Null means no session cookie. It does NOT mean the token is still valid:
 *  an expired one is only discovered by the API, which is why a page that
 *  uses this still awaits loadSession() for its signed-out decision — in
 *  parallel, so it costs nothing extra. */
export const loadToken = cache(async (): Promise<string | null> => {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});

export const loadSession = cache(async (): Promise<Session | null> => {
  const token = await loadToken();
  if (!token) return null;
  try {
    return { token, portal: await fetchPortal(token) };
  } catch (e) {
    // An expired token reads as signed out, which is what it is. Anything
    // else is a real failure and must not be disguised as one.
    if (e instanceof PortalApiError && e.status === 401) return null;
    throw e;
  }
});

/** Every invoice this person has, newest first, across every app — one call.
 *  It was one call per membership until v0.68.61, which is why thread tickets
 *  and meet bookings never appeared: they are in the same ledger and had no
 *  member-facing endpoint.
 *
 *  `failed` is the point of the shape. An empty list and a broken call used to
 *  be the same value here, so the tab showed "Nothing invoiced yet" either
 *  way — and on 2026-10-13 that turned a reported missing invoice into an
 *  hour of ruling things out, because the one surface that could have said
 *  "the call failed" was built to never say it. The tab still renders; it just
 *  tells the truth about which of the two it is. */
export type InvoicesResult = { rows: PortalInvoice[]; failed: boolean };

export const loadInvoices = cache(async (): Promise<InvoicesResult> => {
  const s = await loadSession();
  if (!s) return { rows: [], failed: false };
  try {
    return { rows: await fetchInvoices(s.token), failed: false };
  } catch (e) {
    // Logged where the server can be read, because a member seeing "we could
    // not load this" is only half an answer — somebody has to be able to find
    // out why.
    console.error('[my] /me/invoices failed', e);
    return { rows: [], failed: true };
  }
});

/** The member's own editable details. Null when the call failed — the YOU tab
 *  falls back to what the portal payload already knows rather than showing an
 *  error where a name should be. */
export const loadProfile = cache(async (): Promise<MyProfile | null> => {
  const s = await loadSession();
  if (!s) return null;
  return fetchProfile(s.token);
});

/** Whether a calendar subscription exists, and when a client last collected
 *  it. Falls back to "no subscription" when the call fails: the YOU page then
 *  offers to create one, which is harmless — minting always replaces. */
export const loadCalendarStatus = cache(async (): Promise<CalendarStatus> => {
  const s = await loadSession();
  if (!s) return { subscribed: false, created_at: null, last_read_at: null, url: null, webcal: null };
  return fetchCalendarStatus(s.token);
});

/** What removing this person's data would involve. Null when the call failed
 *  — the YOU tab then omits the section rather than offering a right it
 *  cannot describe accurately. */
/** The member's directory choices, one per community that knows them.
 *
 *  Returns null when the call FAILED, as distinct from an empty list, which
 *  means "no communities". Until 2026-10-05 both came back empty and the YOU
 *  page omitted the section either way: the privacy outcome was right — no
 *  switch is better than a switch showing a state we are unsure of — but it
 *  looked exactly like a working page with nothing on it, which is the one
 *  mistake this repo keeps catching. The page now says so instead. */
export const loadDirectoryChoices = cache(async (): Promise<DirectoryChoice[] | null> => {
  const token = await loadToken();
  if (!token) return [];
  return fetchDirectoryChoices(token);
});

/** The member list of one community. Memoised per workspace id, so the index
 *  page and a list rendered inside it never fetch it twice in one request. */
export const loadDirectoryMembers = cache(async (workspaceId: string): Promise<DirectoryList> => {
  const token = await loadToken();
  if (!token) return { state: 'failed' };
  return fetchDirectoryMembers(token, workspaceId);
});

export const loadErasure = cache(async (): Promise<ErasurePicture | null> => {
  const s = await loadSession();
  if (!s) return null;
  return fetchErasure(s.token);
});
