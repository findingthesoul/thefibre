// WHO the browser pack signs in as.
//
// Until 2026-10-04 every signed-in spec signed in as "the oldest confirmed
// account on staging", which is Sjoerd's own. That was tolerable while the
// specs only looked. It stopped being tolerable the moment one typed 8001
// characters into the profile's bio field, and the member-directory slices
// need signed-in WRITES (switching a listing on, joining with consent) that
// must never happen as a real person.
//
// Two identities, both resolved by what they ARE, never by position in a list:
//
//   THE FIXTURE (the default)   e2e-fixture@example.com, an admin of its own
//       permanent workspace `e2e-fixtures`, with every app switched on and a
//       seat in each. Nobody real. Every spec that writes, and every spec
//       that needs no particular data, runs as it. Created here, idempotently,
//       the first time a run needs it.
//
//   THE OWNER (explicit)        the owner of the `default` workspace: the one
//       super_admin seat there. Three read-only specs need that workspace's
//       real data (a thread with engagements, the EBBF organisation, purchase
//       rows). They ask for it BY NAME (ownerLandUrl / landSignedInAsOwner),
//       and scripts/e2e-identities.test.mjs fails the release gate if any
//       other spec does, or if one of those three clicks a save.
//       An owner sign-in is not free of writes: it inserts one sso_handoff
//       row (marked used when redeemed) and Supabase Auth records a session
//       and a last_sign_in_at. It writes nothing else.
//
// Neither resolver ever falls back to another account. If the account it
// wants is not there it throws, because "a plausible other account" is how
// the pack silently became a test member with three seats on 2026-09-27.
//
// No personal address appears in this file: the owner is found through the
// workspace, and only the fixture's address, which is nobody's, is written out.

import type { SupabaseClient } from '@supabase/supabase-js';
import { assertStagingProject } from './staging-guard.js';

export const E2E_FIXTURE = {
  email: 'e2e-fixture@example.com',
  workspaceSlug: 'e2e-fixtures',
  workspaceName: 'E2E fixtures (permanent, do not edit)',
  displayName: 'E2E Fixture (do not edit)',
  /** Stored the way the editor stores a bio that opens with a paragraph. */
  bio: '<p>The browser pack signs in as this account. Nobody real.</p><p>Second paragraph, so the editor has structure to show.</p>',
  /** Every app the fixture holds a seat in. `membership` is on, with a seat,
   *  and NO community is seeded: the slice that needs one seeds its own. */
  apps: ['the-thread', 'fibre-meet', 'fibre-flow', 'fibre-pulse', 'membership', 'fibre-sales', 'fibre-models'],
} as const;

/** The workspace whose real data three read-only specs look at. */
export const OWNER_WORKSPACE_SLUG = 'default';

export type Identity = { id: string; email: string; workspaceId: string; userRowId: string };

function must<T>(what: string, r: { data: T | null; error: { message: string } | null }): T | null {
  if (r.error) throw new Error(`e2e identities: ${what}: ${r.error.message}`);
  return r.data;
}

async function authUser(service: SupabaseClient, email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const want = email.toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`e2e identities: listUsers page ${page}: ${error.message}`);
    const hit = data.users.find((a) => a.email?.toLowerCase() === want);
    if (hit) return { id: hit.id, confirmed: !!hit.email_confirmed_at };
    if (data.users.length < 200) return null;
  }
  return null;
}

let fixturePromise: Promise<Identity> | null = null;

/**
 * The fixture account, made if it is missing and repaired if it is partial.
 * Looked up by fixed keys, never duplicated, never deleted. Memoised per
 * process, so a run pays for it once.
 */
export function ensureFixtureIdentity(service: SupabaseClient, projectUrl: string): Promise<Identity> {
  fixturePromise ??= build(service, projectUrl).catch((e) => {
    fixturePromise = null;
    throw e;
  });
  return fixturePromise;
}

async function build(service: SupabaseClient, projectUrl: string): Promise<Identity> {
  const F = E2E_FIXTURE;
  // Everything below writes. It writes to staging or it does not run.
  assertStagingProject(projectUrl, 'the e2e fixture account');

  // The workspace.
  let ws = must('workspace', await service.from('workspace').select('id').eq('slug', F.workspaceSlug).maybeSingle());
  if (!ws) {
    ws = must(
      'workspace insert',
      await service.from('workspace').insert({ slug: F.workspaceSlug, name: F.workspaceName }).select('id').single(),
    );
  }
  const workspaceId = ws!.id as string;

  // The sign-in identity.
  let auth = await authUser(service, F.email);
  if (!auth) {
    const { data, error } = await service.auth.admin.createUser({ email: F.email, email_confirm: true });
    if (error || !data.user) throw new Error(`e2e identities: create auth user: ${error?.message}`);
    auth = { id: data.user.id, confirmed: true };
  }
  if (!auth.confirmed) throw new Error(`e2e identities: ${F.email} exists and is not confirmed`);

  // The seat, as an admin.
  let seat = must('user', await service.from('user').select('id').eq('workspace_id', workspaceId).eq('email', F.email).maybeSingle());
  if (!seat) {
    seat = must('user insert', await service.from('user').insert({ workspace_id: workspaceId, email: F.email }).select('id').single());
  }
  const userRowId = seat!.id as string;
  must(
    'workspace_member',
    await service
      .from('workspace_member')
      .upsert({ workspace_id: workspaceId, user_id: userRowId, workspace_role: 'admin' })
      .select('user_id'),
  );

  // The profile: a name that says what it is. The bio is NOT reset here — the
  // specs that write it own its contents and put back what they found.
  const profile = must('profile', await service.from('identity_profile').select('email, bio').eq('email', F.email).maybeSingle());
  if (!profile) {
    must(
      'profile insert',
      await service.from('identity_profile').insert({ email: F.email, display_name: F.displayName, bio: F.bio }).select('email'),
    );
  } else if (!profile.bio) {
    // A standing bio, so a spec that only LOOKS at the editor has something
    // to look at. Only ever filled when empty: a writing spec's own restore
    // is not second-guessed.
    must('profile bio', await service.from('identity_profile').update({ bio: F.bio }).eq('email', F.email).select('email'));
  }

  // Every app on, and a seat in each.
  const apps = must('apps', await service.from('app').select('id, slug').in('slug', [...F.apps])) ?? [];
  const missing = F.apps.filter((slug) => !apps.some((a) => a.slug === slug));
  if (missing.length) throw new Error(`e2e identities: not in the app catalogue on staging: ${missing.join(', ')}`);
  for (const app of apps) {
    const on = must(
      `workspace_app ${app.slug}`,
      await service.from('workspace_app').select('app_id, deactivated_at').eq('workspace_id', workspaceId).eq('app_id', app.id).maybeSingle(),
    );
    if (!on) {
      must(`workspace_app insert ${app.slug}`, await service.from('workspace_app').insert({ workspace_id: workspaceId, app_id: app.id }).select('app_id'));
    } else if (on.deactivated_at) {
      must(
        `workspace_app reactivate ${app.slug}`,
        await service.from('workspace_app').update({ deactivated_at: null }).eq('workspace_id', workspaceId).eq('app_id', app.id).select('app_id'),
      );
    }
    must(
      `app_membership ${app.slug}`,
      await service
        .from('app_membership')
        .upsert({ user_id: userRowId, app_id: app.id, role: 'admin' }, { onConflict: 'user_id,app_id' })
        .select('user_id'),
    );
  }

  // The platform itself has no workspace_app row (it is always on), but its
  // admin screens (Settings → Teams, → Apps) ask for an ADMIN seat in it.
  const platform = must('platform app', await service.from('app').select('id').eq('slug', 'fibre-platform').single());
  must(
    'app_membership fibre-platform',
    await service
      .from('app_membership')
      .upsert({ user_id: userRowId, app_id: platform!.id, role: 'admin' }, { onConflict: 'user_id,app_id' })
      .select('user_id'),
  );

  // PLATFORM SUPER ADMIN, on staging only (Sjoerd, 2026-10-04: "fixture admin
  // yes"). Without it nobody could look at /admin/* — the invoices list, the
  // workspaces, the plans — except by signing in as him, and a sign-in is a
  // minted session for a real person. The guard at the top of this function
  // is what makes this line safe to have; it is asserted again here so that
  // nobody can move the grant above the guard without tripping it.
  assertStagingProject(projectUrl, 'the fixture super-admin grant');
  must('super admin', await service.from('user').update({ is_super_admin: true }).eq('id', userRowId).select('id'));

  // Two purchases in the fixture's own workspace, so the invoices screens
  // have rows: one paid platform row (Stripe-style) and one pending
  // invoice-method row (so "Send payment link" has something to act on).
  // Fixed item_refs: the ledger is unique on (app_id, item_ref), so a second
  // run finds them and writes nothing. The payers are @example.com.
  const thread = apps.find((a) => a.slug === 'the-thread')!;
  const seeds = [
    {
      app_id: platform!.id,
      item_ref: 'e2e-fixture-platform-paid',
      item_label: 'E2E fixture: platform subscription (do not edit)',
      payer_name: 'E2E Payer One',
      payer_email: 'e2e-payer-one@example.com',
      amount_cents: 1900,
      method: 'stripe',
      status: 'paid',
      paid_at: '2026-10-01T09:00:00Z',
    },
    {
      app_id: thread.id,
      item_ref: 'e2e-fixture-invoice-pending',
      item_label: 'E2E fixture: ticket on invoice (do not edit)',
      payer_name: 'E2E Payer Two',
      payer_email: 'e2e-payer-two@example.com',
      amount_cents: 12500,
      method: 'invoice',
      status: 'pending',
      paid_at: null,
    },
  ];
  for (const seed of seeds) {
    const have = must(
      `purchase ${seed.item_ref}`,
      await service.from('purchase').select('id').eq('app_id', seed.app_id).eq('item_ref', seed.item_ref).maybeSingle(),
    );
    if (!have) {
      must(
        `purchase insert ${seed.item_ref}`,
        await service
          .from('purchase')
          .insert({ ...seed, workspace_id: workspaceId, organiser_user_id: userRowId, currency: 'EUR' })
          .select('id'),
      );
    }
  }

  // One seat, so the token hook has nothing to choose between; said anyway.
  must(
    'active workspace',
    await service
      .from('user_active_workspace')
      .upsert({ auth_user_id: auth.id, workspace_id: workspaceId, updated_at: new Date().toISOString() }, { onConflict: 'auth_user_id' })
      .select('auth_user_id'),
  );

  return assertFixture({ id: auth.id, email: F.email, workspaceId, userRowId });
}

/** The default identity is the fixture or it is an error. */
export function assertFixture(identity: Identity): Identity {
  if (identity.email.toLowerCase() !== E2E_FIXTURE.email) {
    throw new Error(
      `e2e identities: the DEFAULT sign-in resolved to ${identity.email}, which is not the fixture (${E2E_FIXTURE.email}). ` +
        `Signed-in specs act as the fixture unless they ask for the owner by name.`,
    );
  }
  return identity;
}

/**
 * The owner of the `default` workspace: its one super_admin seat. Read-only
 * specs only. Throws if there is not exactly one, or it has no confirmed
 * sign-in — it never picks somebody else.
 */
export async function resolveOwnerIdentity(service: SupabaseClient): Promise<Identity> {
  const ws = must('owner workspace', await service.from('workspace').select('id').eq('slug', OWNER_WORKSPACE_SLUG).maybeSingle());
  if (!ws) throw new Error(`e2e identities: no workspace "${OWNER_WORKSPACE_SLUG}" on staging`);
  const owners =
    must(
      'owner seat',
      await service
        .from('workspace_member')
        .select('user_id, user:user_id (id, email, deleted_at)')
        .eq('workspace_id', ws.id)
        .eq('workspace_role', 'super_admin'),
    ) ?? [];
  const live = owners
    .map((o) => (Array.isArray(o.user) ? o.user[0] : o.user) as { id: string; email: string; deleted_at: string | null } | null)
    .filter((u): u is { id: string; email: string; deleted_at: string | null } => !!u && !u.deleted_at);
  if (live.length !== 1) {
    throw new Error(`e2e identities: "${OWNER_WORKSPACE_SLUG}" has ${live.length} owner seats (super_admin), expected exactly one`);
  }
  const seat = live[0]!;
  if (String(seat.email).toLowerCase() === E2E_FIXTURE.email) {
    throw new Error('e2e identities: the owner resolved to the fixture; the two identities must be different people');
  }
  const auth = await authUser(service, String(seat.email));
  if (!auth || !auth.confirmed) throw new Error(`e2e identities: the owner of "${OWNER_WORKSPACE_SLUG}" has no confirmed sign-in`);
  return { id: auth.id, email: String(seat.email), workspaceId: ws.id as string, userRowId: seat.id };
}
