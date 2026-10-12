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

export const E2E_MEMBER = {
  email: 'e2e-member@example.com',
  displayName: 'E2E Member (do not edit)',
  /** The SAME apps as the fixture, so a ROLE is the only difference between
   *  the two accounts and a role branch is what a spec is actually seeing. */
  apps: E2E_FIXTURE.apps,
} as const;

/** The fixture's own thread, so the organiser screens have a thread to open
 *  that belongs to nobody. Slugs are fixed: a second run finds it. */
export const E2E_THREAD = {
  slug: 'e2e-year-agenda',
  organiserSlug: 'e2e-fixtures',
  programTitle: 'E2E fixture thread (do not edit)',
  /** The session the calendar tray is about. Far future, so it can never
   *  look like something anybody should attend. */
  sessionTitle: 'E2E session (do not edit)',
  sessionStartsAt: '2027-11-02T10:00:00Z',
  sessionEndsAt: '2027-11-02T11:00:00Z',
  /** The one engagement that carries the "Sends the ticket" badge. */
  confirmTitle: "You're enrolled: E2E fixture thread",
  /** The OTHER system message, which must NOT carry it. Both exist so the
   *  badge test proves the label is specific to the confirmed row rather
   *  than to any system row — a second `enrolment_confirmed` is impossible
   *  (thread_engagement_system_role_uniq), so this is what makes that test
   *  able to fail at all. */
  receivedTitle: 'We got your application: E2E fixture thread',
  /** A person to find in the Add-participant search. The search matches name
   *  OR email, and the row the spec picks is the one showing an address. */
  personFirst: 'Esther',
  personLast: 'Searchable',
  personEmail: 'e2e-searchable@example.com',
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

  // BILLING DETAILS ON THE WORKSPACE, so the workspace half of Settings →
  // Payments exists at all. The shared form offers it when `isAdmin ||
  // workspaceAccount !== null || workspaceDetails !== null` — so without
  // this, a NON-ADMIN saw only their personal account and the role branch
  // worth checking (the workspace's own account, named, read-only, with a
  // sentence saying who may change it) could not be seen on this workspace.
  // Measured before writing it: the member fixture's Payments screen had no
  // tabs at all.
  //
  // Filled only when empty, like the bio: a spec that writes these owns what
  // it leaves behind. No Stripe account id — a pasted `acct_` grants nothing
  // and the badge would claim a connection that does not exist.
  const billing = must(
    'workspace billing',
    await service.from('workspace').select('invoice_details').eq('id', workspaceId).maybeSingle(),
  );
  if (!billing?.invoice_details) {
    must(
      'workspace billing insert',
      await service
        .from('workspace')
        .update({
          invoice_details: {
            legal_name: F.workspaceName,
            address: 'Nowhere 1, 0000 XX, Testland',
            tax_no: 'NL000000000B00',
          },
        })
        .eq('id', workspaceId)
        .select('id'),
    );
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

let memberPromise: Promise<Identity> | null = null;

/**
 * THE MEMBER (explicit)  e2e-member@example.com — the fixture's workspace,
 * the fixture's app seats, and `workspace_role: 'organiser'` instead of
 * 'admin'.
 *
 * WHY IT EXISTS: a great deal of this product is a role branch, and until now
 * the only way to see the non-admin side of a screen was to reason about the
 * route. "The GET has no role check, so a member would see the workspace
 * name" is an argument, not an observation (2026-10-12, Settings → Payments).
 * Now it can be looked at.
 *
 * WHY IT IS PERMANENT, AND NOT TORN DOWN. A fixture created per run must be
 * deleted per run, and a teardown that MUST run is a liability: on
 * 2026-10-01 two probes leaked staging workspaces because the rows were
 * created before the `try` meant to clean them up. This account is found by a
 * fixed address, repaired when partial, and never deleted — so there is
 * nothing to leak and a run that dies halfway leaves staging as it found it.
 *
 * WHAT IT IS NOT: not a platform super admin, not a workspace admin, and
 * never the default. Specs ask for it BY NAME, and `assertMember` refuses any
 * other address — the fixture's and the owner's included.
 */
export function ensureMemberIdentity(service: SupabaseClient, projectUrl: string): Promise<Identity> {
  memberPromise ??= buildMember(service, projectUrl).catch((e) => {
    memberPromise = null;
    throw e;
  });
  return memberPromise;
}

async function buildMember(service: SupabaseClient, projectUrl: string): Promise<Identity> {
  const M = E2E_MEMBER;
  assertStagingProject(projectUrl, 'the e2e member account');

  // The fixture's workspace: this account is the OTHER ROLE in the same
  // place, never a workspace of its own. Same data, one difference.
  const fixture = await ensureFixtureIdentity(service, projectUrl);
  const workspaceId = fixture.workspaceId;

  let auth = await authUser(service, M.email);
  if (!auth) {
    const { data, error } = await service.auth.admin.createUser({ email: M.email, email_confirm: true });
    if (error || !data.user) throw new Error(`e2e identities: create member auth user: ${error?.message}`);
    auth = { id: data.user.id, confirmed: true };
  }
  if (!auth.confirmed) throw new Error(`e2e identities: ${M.email} exists and is not confirmed`);

  let seat = must(
    'member user',
    await service.from('user').select('id, is_super_admin').eq('workspace_id', workspaceId).eq('email', M.email).maybeSingle(),
  );
  if (!seat) {
    seat = must(
      'member user insert',
      await service.from('user').insert({ workspace_id: workspaceId, email: M.email }).select('id, is_super_admin').single(),
    );
  }
  const userRowId = seat!.id as string;
  // ASSERTED, not assumed. A member that had quietly become a super admin
  // would make every role spec pass for the wrong reason — the 2026-09-27
  // failure exactly, where the pack became a different account and the
  // specs went on reporting green.
  if (seat!.is_super_admin) {
    throw new Error(`e2e identities: ${M.email} is a platform super admin; the member identity must not be one`);
  }

  // 'organiser' is the non-admin workspace role (the column allows
  // super_admin | admin | organiser). UPSERT, so a role raised by hand on
  // staging is put back rather than silently honoured.
  must(
    'member workspace_member',
    await service
      .from('workspace_member')
      .upsert({ workspace_id: workspaceId, user_id: userRowId, workspace_role: 'organiser' })
      .select('user_id'),
  );

  const profile = must('member profile', await service.from('identity_profile').select('email').eq('email', M.email).maybeSingle());
  if (!profile) {
    must(
      'member profile insert',
      await service.from('identity_profile').insert({ email: M.email, display_name: M.displayName }).select('email'),
    );
  }

  // Seats in the same apps, at role 'member' (app_membership takes
  // 'member' | 'admin'). The workspace_app rows are the fixture's doing.
  const apps = must('member apps', await service.from('app').select('id, slug').in('slug', [...M.apps])) ?? [];
  const platform = must('platform app', await service.from('app').select('id').eq('slug', 'fibre-platform').single());
  for (const app of [...apps, { id: platform!.id, slug: 'fibre-platform' }]) {
    must(
      `member app_membership ${app.slug}`,
      await service
        .from('app_membership')
        .upsert({ user_id: userRowId, app_id: app.id, role: 'member' }, { onConflict: 'user_id,app_id' })
        .select('user_id'),
    );
  }

  must(
    'member active workspace',
    await service
      .from('user_active_workspace')
      .upsert({ auth_user_id: auth.id, workspace_id: workspaceId, updated_at: new Date().toISOString() }, { onConflict: 'auth_user_id' })
      .select('auth_user_id'),
  );

  return assertMember({ id: auth.id, email: M.email, workspaceId, userRowId });
}

/** The member identity is that one address or it is an error. */
export function assertMember(identity: Identity): Identity {
  if (identity.email.toLowerCase() !== E2E_MEMBER.email) {
    throw new Error(
      `e2e identities: the MEMBER sign-in resolved to ${identity.email}, which is not the member fixture (${E2E_MEMBER.email}).`,
    );
  }
  return identity;
}

export type FixtureThread = {
  threadId: string;
  organiserSlug: string;
  sessionId: string;
  personName: string;
  personEmail: string;
};

let threadPromise: Promise<FixtureThread> | null = null;

/**
 * A THREAD OF THE FIXTURE'S OWN.
 *
 * The organiser-screen checks used to open the owner's `year-agenda` thread,
 * which meant signing in as a real person to look at a tray — and worse,
 * their fixture WROTE a queued calendar change into his workspace. It never
 * actually did (it only inserts when the queue is empty, and his has had a
 * change parked since 2026-09-24), but a send takes EVERY pending change on a
 * thread, so a leftover row would have ridden along with his next genuine
 * send to all sixteen enrolled people.
 *
 * This thread belongs to nobody, has no enrolments at all, and its session is
 * in November 2027. A send here could reach no one even if a spec pressed it.
 */
export function ensureFixtureThread(service: SupabaseClient, projectUrl: string): Promise<FixtureThread> {
  threadPromise ??= buildThread(service, projectUrl).catch((e) => {
    threadPromise = null;
    throw e;
  });
  return threadPromise;
}

async function buildThread(service: SupabaseClient, projectUrl: string): Promise<FixtureThread> {
  const T = E2E_THREAD;
  assertStagingProject(projectUrl, 'the e2e fixture thread');
  const fixture = await ensureFixtureIdentity(service, projectUrl);
  const workspaceId = fixture.workspaceId;

  const threadApp = must('the-thread app', await service.from('app').select('id').eq('slug', 'the-thread').single());

  // The organiser row. `user_id` is UNIQUE, so the fixture has at most one,
  // and its slug is the first segment of every public URL it owns.
  let organiser = must(
    'organiser',
    await service.from('thread_organiser').select('id, slug').eq('user_id', fixture.userRowId).maybeSingle(),
  );
  if (!organiser) {
    organiser = must(
      'organiser insert',
      await service
        .from('thread_organiser')
        .insert({
          user_id: fixture.userRowId,
          workspace_id: workspaceId,
          slug: T.organiserSlug,
          display_name: E2E_FIXTURE.workspaceName,
        })
        .select('id, slug')
        .single(),
    );
  }

  // The thread, found by (organiser, slug) — the pair its own public URL is
  // unique on, so there can only ever be one.
  let thread = must(
    'thread',
    await service
      .from('thread_thread')
      .select('id')
      .eq('organiser_id', organiser!.id as string)
      .eq('slug', T.slug)
      .maybeSingle(),
  );
  if (!thread) {
    // thread_thread.program_id is NOT NULL and UNIQUE: a thread IS a
    // programme, one to one.
    const program = must(
      'program insert',
      await service
        .from('program')
        .insert({ workspace_id: workspaceId, app_id: threadApp!.id, title: T.programTitle, format: 'journey', status: 'active' })
        .select('id')
        .single(),
    );
    thread = must(
      'thread insert',
      await service
        .from('thread_thread')
        .insert({
          workspace_id: workspaceId,
          program_id: program!.id,
          organiser_id: organiser!.id,
          slug: T.slug,
          timezone: 'Europe/Amsterdam',
          // NOT listed and NOT open: a fixture thread has no business
          // appearing on a public page or taking an enrolment.
          is_public_listed: false,
          public_enrolment_open: false,
          language: 'en',
          created_by: fixture.userRowId,
        })
        .select('id')
        .single(),
    );
  }
  const threadId = thread!.id as string;

  // Two engagements, each found by (thread, title):
  //   the session   — what the calendar tray is about
  //   the confirmed — the one row that carries "Sends the ticket"
  async function engagement(title: string, row: Record<string, unknown>): Promise<string> {
    const have = must(
      `engagement ${title}`,
      await service.from('thread_engagement').select('id').eq('thread_id', threadId).eq('title', title).maybeSingle(),
    );
    if (have) return have.id as string;
    const made = must(
      `engagement insert ${title}`,
      await service
        .from('thread_engagement')
        .insert({ workspace_id: workspaceId, thread_id: threadId, title, ...row })
        .select('id')
        .single(),
    );
    return made!.id as string;
  }

  const sessionId = await engagement(T.sessionTitle, {
    type: 'event',
    status: 'published',
    starts_at: T.sessionStartsAt,
    ends_at: T.sessionEndsAt,
    trigger_kind: 'fixed',
    show_in_agenda: true,
    position: -1,
  });
  await engagement(T.confirmTitle, {
    type: 'message',
    status: 'published',
    system_role: 'enrolment_confirmed',
    trigger_kind: 'on_enrolment',
    show_in_agenda: false,
    position: -2,
  });
  await engagement(T.receivedTitle, {
    type: 'message',
    status: 'published',
    system_role: 'enrolment_received',
    trigger_kind: 'on_enrolment',
    show_in_agenda: false,
    position: -3,
  });

  // Somebody for the Add-participant search to find. A person in the
  // workspace with an address, because the row the spec picks is the one
  // showing an email rather than the "add as new" row.
  const person = must(
    'search person',
    await service.from('person').select('id').eq('workspace_id', workspaceId).eq('email', T.personEmail).maybeSingle(),
  );
  if (!person) {
    must(
      'search person insert',
      await service
        .from('person')
        .insert({ workspace_id: workspaceId, first_name: T.personFirst, last_name: T.personLast, email: T.personEmail })
        .select('id'),
    );
  }

  return {
    threadId,
    organiserSlug: organiser!.slug as string,
    sessionId,
    personName: `${T.personFirst} ${T.personLast}`,
    personEmail: T.personEmail,
  };
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
  // OPT-IN, by Sjoerd's decision on 2026-10-12: "owner tests opt-in".
  //
  // e2e/playwright.config.ts keeps the owner spec FILES out of a plain run.
  // This is the other door: an owner call written into a spec that is not
  // excluded, or into a helper, or a script that imports this module. It
  // throws rather than skipping, because reaching this line without the flag
  // is a mistake in the code, not a test that cannot run today.
  if (process.env.E2E_OWNER !== '1') {
    throw new Error(
      'e2e identities: the owner identity is OPT-IN. It signs in as a real person ' +
        "(the one super_admin of the staging `default` workspace, not a fixture). " +
        'Set E2E_OWNER=1 to run the specs that need that workspace\'s own data, ' +
        'or use the fixture identity (the default) / the member fixture.',
    );
  }
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
