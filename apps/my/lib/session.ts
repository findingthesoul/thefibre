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
  fetchInvoices,
  fetchPortal,
  fetchProfile,
  PortalApiError,
  type MyProfile,
  type Portal,
  type PortalInvoice,
} from './portal-api';

export type Session = { token: string; portal: Portal };

export const loadSession = cache(async (): Promise<Session | null> => {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    return { token: session.access_token, portal: await fetchPortal(session.access_token) };
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
 *  member-facing endpoint. */
export const loadInvoices = cache(async (): Promise<PortalInvoice[]> => {
  const s = await loadSession();
  if (!s) return [];
  return fetchInvoices(s.token);
});

/** The member's own editable details. Null when the call failed — the YOU tab
 *  falls back to what the portal payload already knows rather than showing an
 *  error where a name should be. */
export const loadProfile = cache(async (): Promise<MyProfile | null> => {
  const s = await loadSession();
  if (!s) return null;
  return fetchProfile(s.token);
});
