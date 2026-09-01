// Your profile, and it follows you between workspaces.
//
// A seat is per workspace on purpose — role, apps, visibility all differ per
// tenant. Your face is not one of those things, but `user_profile` was keyed
// to the seat, so a person with two workspaces filled it in twice. Sjoerd had
// a bio in one and a photo in the other; Tahirih had one profile and one
// blank (20260901160000).
//
// Keyed by email: the same key that finds someone's seats in the first place
// (auth.myMemberships). ONE reader, here, so the fallback to the old per-seat
// rows exists in one place and can be deleted in one place.

import { adminClient } from '../db.js';

export type IdentityProfile = {
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  timezone: string | null;
};

const EMPTY: IdentityProfile = {
  display_name: null,
  bio: null,
  photo_url: null,
  timezone: null,
};

async function emailFor(userId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('user')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  return data?.email ?? null;
}

/**
 * The profile for whoever holds this seat.
 *
 * `user_profile` is a read fallback for a row the backfill could not reach —
 * a seat created between the migration and this deploy. Nothing writes it.
 */
export async function profileFor(userId: string): Promise<IdentityProfile> {
  if (!userId) return EMPTY;
  const email = await emailFor(userId);
  if (!email) return EMPTY;

  const [{ data: identity }, { data: legacy }] = await Promise.all([
    adminClient
      .from('identity_profile')
      .select('display_name, bio, photo_url, timezone')
      .eq('email', email)
      .maybeSingle(),
    adminClient
      .from('user_profile')
      .select('display_name, bio, photo_url, timezone')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  return {
    display_name: identity?.display_name ?? legacy?.display_name ?? null,
    bio: identity?.bio ?? legacy?.bio ?? null,
    photo_url: identity?.photo_url ?? legacy?.photo_url ?? null,
    timezone: identity?.timezone ?? legacy?.timezone ?? null,
  };
}

/** Provisioned on first read so the profile screen always has a row to edit. */
export async function ensureProfile(userId: string): Promise<IdentityProfile & { email: string }> {
  const email = await emailFor(userId);
  if (!email) throw new Error('no email for user');
  const existing = await adminClient
    .from('identity_profile')
    .select('display_name, bio, photo_url, timezone')
    .eq('email', email)
    .maybeSingle();
  if (existing.data) return { ...existing.data, email };

  // Seeded from the seat's own name, and from the old per-seat profile if this
  // person had one — a new workspace should not hand somebody a blank face.
  const legacy = await profileFor(userId);
  const { data: u } = await adminClient
    .from('user')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  const seed = {
    email,
    display_name: legacy.display_name ?? u?.full_name ?? null,
    bio: legacy.bio,
    photo_url: legacy.photo_url,
    timezone: legacy.timezone ?? 'Europe/Amsterdam',
  };
  const { data: created, error } = await adminClient
    .from('identity_profile')
    .upsert(seed, { onConflict: 'email' })
    .select('display_name, bio, photo_url, timezone')
    .single();
  if (error || !created) throw new Error(error?.message ?? 'could not provision profile');
  return { ...created, email };
}

export async function saveProfile(
  userId: string,
  patch: Partial<Record<keyof IdentityProfile, string | null | undefined>>,
): Promise<{ error?: string }> {
  const email = await emailFor(userId);
  if (!email) return { error: 'no email for user' };
  const { error } = await adminClient
    .from('identity_profile')
    .upsert({ email, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  return error ? { error: error.message } : {};
}

/** Personal payment details. Owner-only by policy — see the migration. */
export async function billingFor(userId: string): Promise<{
  stripe_account_id: string | null;
  invoice_details: unknown;
  default_payment_methods: string[] | null;
}> {
  const email = await emailFor(userId);
  if (!email) return { stripe_account_id: null, invoice_details: null, default_payment_methods: null };
  const [{ data: identity }, { data: legacy }] = await Promise.all([
    adminClient
      .from('identity_billing')
      .select('stripe_account_id, invoice_details, default_payment_methods')
      .eq('email', email)
      .maybeSingle(),
    adminClient
      .from('user_profile')
      .select('stripe_account_id, invoice_details, default_payment_methods')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  return {
    stripe_account_id: identity?.stripe_account_id ?? legacy?.stripe_account_id ?? null,
    invoice_details: identity?.invoice_details ?? legacy?.invoice_details ?? null,
    default_payment_methods:
      identity?.default_payment_methods ?? legacy?.default_payment_methods ?? null,
  };
}

export async function saveBilling(
  userId: string,
  patch: Record<string, unknown>,
): Promise<{ error?: string }> {
  const email = await emailFor(userId);
  if (!email) return { error: 'no email for user' };
  const { error } = await adminClient
    .from('identity_billing')
    .upsert({ email, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  return error ? { error: error.message } : {};
}
