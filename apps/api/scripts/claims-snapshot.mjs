#!/usr/bin/env node
// What custom_access_token_hook stamps into an ORDINARY session's JWT for one
// person — app_user_id, workspace_id, app_memberships, session_id — printed
// as JSON so two runs can be diffed.
//
// Why: the hook runs on every token mint for every signed-in person in every
// app. A migration that changes it (2026-10-01: pinning MCP-grant sessions to
// their workspace) must be shown to leave everyone ELSE's claims untouched —
// a before/after of the same person's claims, not a "the new select returns
// nothing" argument. The session is minted the way verify-*.mjs mint theirs
// (generateLink → verifyOtp, no email sent); it is NOT an MCP grant's session,
// so the pin never applies to it.
//
// Run it for a person with a LOWERCASE email AND one whose public.user.email
// carries a capital letter. The 2026-10-01 hook rewrite was proved
// "identical" with the lowercase one only, and had silently dropped the
// case-insensitive join (20260907190000) — every mixed-case user would have
// been locked out. hook-case.int.test.ts covers that case end to end; this
// script is the quick before/after you run around any hook migration.
//
// Usage:
//   FIBRE_ENV_FILE=.env.staging node scripts/claims-snapshot.mjs            # sjoerd@soul.com
//   FIBRE_ENV_FILE=.env.staging FIBRE_ADMIN_EMAIL=Mixed.Case@example.org node scripts/claims-snapshot.mjs

import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from './lib/env.mjs';

const { url, anonKey, serviceKey } = supabaseEnv();
const EMAIL = process.env.FIBRE_ADMIN_EMAIL ?? 'sjoerd@soul.com';

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
if (error || !link?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message ?? 'no token'}`);
const { data, error: vErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (vErr || !data.session) throw new Error(`verifyOtp failed: ${vErr?.message ?? 'no session'}`);

const claims = JSON.parse(Buffer.from(data.session.access_token.split('.')[1], 'base64url').toString('utf8'));
const picked = {
  email: EMAIL,
  app_user_id: claims.app_user_id ?? null,
  workspace_id: claims.workspace_id ?? null,
  app_memberships: Array.isArray(claims.app_memberships) ? [...claims.app_memberships].sort() : null,
  has_session_id: typeof claims.session_id === 'string',
};
console.log(JSON.stringify(picked, null, 2));
// Leave nothing behind: this session was for the snapshot only.
await anon.auth.admin?.signOut?.(data.session.access_token).catch?.(() => {});
