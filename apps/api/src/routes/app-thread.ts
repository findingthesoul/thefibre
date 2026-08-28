// The app-facing Thread surface — docs/brief-thread-and-registrations.md §1.
//
// Why this file exists instead of allow-listing /api/v1/thread/*: every route
// in routes/thread.ts runs on `userClient(ctx.jwt)` and is bounded by RLS
// acting on a real signed-in user. There is no user behind an app key, so
// those routes deny everything. Exactly the situation app-flow.ts was written
// to solve, and this follows it deliberately rather than inventing a second
// shape.
//
// What an external app can do here is narrow on purpose: publish a programme
// as a public page, read it back, edit it as the plan firms up, and see who
// registered. That is the whole arc the planner needs.
//
// It CANNOT write enrolments. There is no `write:enrolments` scope, by design:
// an app that could write them could enrol arbitrary people in arbitrary
// programmes, and the enrolment row is what the certificate and payout chain
// hangs off. Registration comes from the public form, never from an app.
//
// ===========================================================================
// THE WALL — read this before touching any select in this file.
// ===========================================================================
//
// `thread_enrolment` mixes three kinds of data, and only one of them may
// leave:
//
//   May leave      who registered, and where their registration stands
//   MUST NOT       `answers` — the responses to whatever the organiser asked
//                  on the registration form. The schema has said so since it
//                  was written: "never crosses the wall".
//   MUST NOT       `amount_cents`, `coupon_id`, `stripe_session_id`,
//                  `stripe_payment_intent`. An app that plans festivals has
//                  no business reading payment instruments.
//
// Two things keep that true, and it is worth being precise about which does
// the work, because the obvious answer is wrong.
//
//   1. The response is built field by field. THIS is the protection. Nothing
//      reaches a caller unless it is named in the mapping, so the way to
//      breach the wall is to write `...r` into that object — which reads as a
//      harmless tidy-up and is the regression to actually fear.
//   2. ENROLMENT_SELECT names its columns. This is belt and braces: on its
//      own, switching it to `select('*')` leaks nothing, because the mapping
//      still filters. It earns its place by keeping the walled values out of
//      the process altogether, so a later `...r` has nothing to spread.
//
// verify-external-app.mjs asserts the walled fields are ABSENT from the
// response — an absence is the one thing the shape checks cannot catch. That
// assertion was tested by sabotage: a `...r` spread fails it loudly, and a
// bare `select('*')` correctly does not, because it is not itself a leak.
//
// `payment_status` IS exposed. It is a state — not_required / pending / paid
// / refunded / failed — not an instrument, and an organiser tool showing a
// registration list without it would be useless.
//
// ===========================================================================
// THE CONTRACT — same rules as app-flow.ts.
// ===========================================================================
//
// ADDITIVE ONLY. Add a field. Never rename one, never remove one, never
// change a field's type or the meaning of a value. A response key that has
// shipped is permanent. If a change genuinely cannot be additive, add a
// second versioned path alongside rather than quietly breaking callers.
//
// The shape below is deliberately not the shape of the tables: a "thread" over
// the wire flattens `program` (the platform's programme) and `thread_thread`
// (The Thread's storefront) into one object, because an app should not have to
// know that the split exists.

import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import type { RequestContext } from '../middleware/app-context.js';

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function appKeyOnly(c: Context): RequestContext | null {
  const ctx = c.get('ctx') as RequestContext;
  return ctx.auth === 'app_key' ? ctx : null;
}

function notForUsers(c: Context) {
  return c.json(
    {
      error:
        'this surface is for app keys; a signed-in user should use /api/v1/thread/* which is bounded by The Thread’s own permissions',
    },
    403,
  );
}

/**
 * A thread this app published, or null.
 *
 * Ownership is `program.source_app`, matching how app-flow.ts scopes runs. An
 * app never sees a thread a person made in The Thread's own UI, nor another
 * app's — the same rule, so there is one thing to reason about.
 */
async function ownThread(ctx: RequestContext, threadId: string) {
  const { data } = await adminClient
    .from('thread_thread')
    .select(
      'id, workspace_id, program_id, organiser_id, slug, intention, timezone, language, cover_url, is_public_listed, requires_approval, public_interaction, share_participants_public, share_participants_participants, price_cents, price_currency, capacity, created_at, updated_at, program:program_id (id, title, format, status, starts_on, ends_on, source_app, source_ref), organiser:organiser_id (id, slug, display_name)',
    )
    .eq('id', threadId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!data) return null;
  const program = one(data.program);
  if (!program || program.source_app !== ctx.appId) return null;
  return data;
}

/** PostgREST returns an embedded FK as an object or a one-element array. */
function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

/** The published shape. Flattens programme + storefront into one object. */
function shapeThread(row: Record<string, any>) {
  const program = one(row.program) ?? {};
  const organiser = one(row.organiser) ?? {};
  return {
    id: row.id,
    program_id: row.program_id,
    slug: row.slug,
    title: program.title ?? null,
    format: program.format ?? null,
    status: program.status ?? null,
    starts_on: program.starts_on ?? null,
    ends_on: program.ends_on ?? null,
    intention: row.intention,
    timezone: row.timezone,
    language: row.language,
    cover_url: row.cover_url,
    is_public_listed: row.is_public_listed,
    requires_approval: row.requires_approval,
    public_interaction: row.public_interaction,
    share_participants_public: row.share_participants_public,
    share_participants_participants: row.share_participants_participants,
    price_cents: row.price_cents,
    price_currency: row.price_currency,
    capacity: row.capacity,
    source_ref: program.source_ref ?? null,
    organiser: {
      slug: organiser.slug ?? null,
      display_name: organiser.display_name ?? null,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PublishThread = z.object({
  title: z.string().min(1).max(200),
  format: z.enum(['event', 'journey']),
  slug: z.string().min(2).max(80).regex(SLUG_RE, 'lowercase kebab-case'),
  /**
   * Whose festival this is. A person, not a user id — the app already links
   * its organiser to a Fibre person, and it should not have to learn about
   * platform user rows to publish. Resolved here to that person's Thread
   * organiser profile.
   *
   * OPTIONAL. Omit it and the workspace publishes under its own organiser.
   *
   * External apps are the reason. Their organisers sign in to the app's own
   * database, which this platform knows nothing about, so they have no Fibre
   * account and can never satisfy the checks below — and an app has no route
   * that would tell it who in the workspace can. Requiring the field meant
   * every such app had to be configured with a person it could not look up.
   * The app key is already scoped to one workspace; that is enough to know.
   */
  organiser_person_id: z.string().uuid().optional(),
  intention: z.string().max(2000).nullable().optional(),
  starts_on: z.string().date().nullable().optional(),
  ends_on: z.string().date().nullable().optional(),
  timezone: z.string().max(100).optional(),
  /** The app's own id for this festival. Makes publishing idempotent. */
  source_ref: z.string().uuid().optional().nullable(),
});

const PatchThread = z.object({
  title: z.string().min(1).max(200).optional(),
  intention: z.string().max(2000).nullable().optional(),
  starts_on: z.string().date().nullable().optional(),
  ends_on: z.string().date().nullable().optional(),
  cover_url: z.string().url().max(1000).nullable().optional(),
  is_public_listed: z.boolean().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  /**
   * draft -> active is the moment the page is live AND enrolment is open.
   * There is one decision behind it, not two — see §3 of
   * docs/brief-thread-event-settings.md. Do not split it without saying so on
   * both sides, or the planner and The Thread will drift on what "live" means.
   */
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),

  // --- §2 of the brief: columns that already existed and the app could not
  // reach. All live on thread_thread. Each shape mirrors its column exactly —
  // a NOT NULL column is optional-but-not-nullable here, so a null becomes a
  // 400 from Zod rather than a 500 from Postgres.
  /** The festival's own timezone, not the workspace default. NOT NULL. */
  timezone: z.string().min(1).max(100).optional(),
  /** Mirrors the column's check constraint. NOT NULL. */
  language: z.enum(['en', 'nl', 'es', 'pt', 'de']).optional(),
  /** "People apply, we admit" rather than open enrolment. NOT NULL. */
  requires_approval: z.boolean().optional(),
  /** page = its own page; popup = the enrol popup. NOT NULL. */
  public_interaction: z.enum(['page', 'popup']).optional(),
  /** Whether visitors see who is coming. NOT NULL. */
  share_participants_public: z.boolean().optional(),
  /** Whether participants see each other. NOT NULL. */
  share_participants_participants: z.boolean().optional(),
  /** Nullable on purpose: null is a free event, stated rather than unset. */
  price_cents: z.number().int().min(0).nullable().optional(),
  /** char(3). Nullable alongside price_cents. */
  price_currency: z.string().length(3).nullable().optional(),

  // registration_fields is deliberately NOT here. It shapes what is asked of a
  // registrant, and the data wall exists precisely so an app does not reach
  // into that. See the caution in §2 of the brief.
});

// The ONLY permitted column list on thread_enrolment. See THE WALL above.
const ENROLMENT_SELECT = 'id, enrolment_id, person_id, payment_status, created_at';

/**
 * The workspace's own Thread organiser, created from its admin if it has none.
 *
 * Rights follow function: whoever administers the workspace may publish for it.
 * Returns the earliest admin's storefront so the same workspace always
 * publishes under the same one.
 */
async function deriveWorkspaceOrganiser(
  workspaceId: string,
): Promise<{ organiser: { id: string } } | { error: string }> {
  const { data: workspace } = await adminClient
    .from('workspace')
    .select('slug, name')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!workspace) return { error: 'workspace not found' };

  const { data: admins } = await adminClient
    .from('workspace_member')
    .select('user_id, workspace_role, joined_at')
    .eq('workspace_id', workspaceId)
    .in('workspace_role', ['super_admin', 'admin'])
    .order('joined_at', { ascending: true })
    .limit(1);

  const admin = admins?.[0];
  if (!admin) {
    // v0.18.8 fixed the case that produced these; a workspace predating it can
    // still have none, and silently publishing under nobody would be worse.
    return { error: 'this workspace has no admin to publish as' };
  }

  // Same slug shape as the auto-provision in routes/thread.ts (`GET
  // /thread/me`): a seed plus a short random suffix. Bare workspace.slug would
  // collide with a person who already took it, and `unique (workspace_id,
  // slug)` would reject the insert.
  const seed =
    workspace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'organiser';
  const slug = `${seed}-${Math.random().toString(36).slice(2, 5)}`;

  const { data: created, error } = await adminClient
    .from('thread_organiser')
    .insert({
      user_id: admin.user_id,
      workspace_id: workspaceId,
      slug,
      display_name: workspace.name,
    })
    .select('id')
    .single();

  if (error) {
    // thread_organiser.user_id is UNIQUE across the whole table, not per
    // workspace — so this admin may already have a storefront, and the lookup
    // must not filter by workspace or it will find nothing and report the
    // wrong thing. Two publishes racing land here too.
    const { data: existing } = await adminClient
      .from('thread_organiser')
      .select('id, workspace_id')
      .eq('user_id', admin.user_id)
      .maybeSingle();
    if (existing?.workspace_id === workspaceId) return { organiser: { id: existing.id } };
    if (existing) {
      return {
        error: 'this workspace’s admin already organises in another workspace',
      };
    }
    console.error('[app-thread] could not derive a workspace organiser', error);
    return { error: 'could not create a Thread organiser for this workspace' };
  }

  return { organiser: created };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
export function registerAppThreadRoutes(appsRoutes: Hono) {
  // -------------------------------------------------------------------------
  // POST /apps/:slug/thread/threads — publish a programme as a public page.
  //
  // Creates the platform `program` and The Thread's `thread_thread` together,
  // because neither is useful alone. Idempotent on source_ref, following the
  // flow_run precedent: a retried publish returns the thread that already
  // exists rather than a second public page.
  // -------------------------------------------------------------------------
  appsRoutes.post('/:slug/thread/threads', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    const body = PublishThread.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const b = body.data;

    if (b.starts_on && b.ends_on && b.ends_on < b.starts_on) {
      return c.json({ error: 'the end date cannot be before the start date' }, 400);
    }

    // Idempotency first, before anything is written.
    if (b.source_ref) {
      const { data: existing } = await adminClient
        .from('program')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('source_app', ctx.appId)
        .eq('source_ref', b.source_ref)
        .maybeSingle();
      if (existing) {
        const { data: t } = await adminClient
          .from('thread_thread')
          .select('id')
          .eq('program_id', existing.id)
          .maybeSingle();
        if (t) {
          const full = await ownThread(ctx, t.id);
          return c.json({ ...(full ? shapeThread(full) : { id: t.id }), created: false }, 200);
        }
      }
    }

    // The organiser must be a real person in this workspace who has a Thread
    // organiser profile. An app cannot invent one: publishing under a
    // storefront nobody owns would leave a page with no human behind it.
    //
    // Named explicitly, or — when the app names nobody — the workspace's own.
    let organiser: { id: string } | null = null;

    if (b.organiser_person_id) {
      const { data: person } = await adminClient
        .from('person')
        .select('id')
        .eq('id', b.organiser_person_id)
        .eq('workspace_id', ctx.workspaceId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!person) return c.json({ error: 'organiser_person_id is not a person in this workspace' }, 404);

      const { data: user } = await adminClient
        .from('user')
        .select('id')
        .eq('person_id', person.id)
        .eq('workspace_id', ctx.workspaceId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!user) {
        return c.json(
          { error: 'that person has no Fibre account, so they cannot be an organiser yet' },
          400,
        );
      }

      const { data } = await adminClient
        .from('thread_organiser')
        .select('id')
        .eq('user_id', user.id)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle();
      if (!data) {
        return c.json(
          { error: 'that person has no Thread organiser profile — they need to visit The Thread’s settings once' },
          400,
        );
      }
      organiser = data;
    } else {
      // The workspace's own organiser. Earliest, which is the one the first
      // admin created — a workspace with several storefronts and no explicit
      // choice has no better answer, and a stable one beats an arbitrary one.
      const { data } = await adminClient
        .from('thread_organiser')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        organiser = data;
      } else {
        // Derive it from function rather than asking for a settings visit.
        //
        // A workspace admin already has the authority to publish on the
        // workspace's behalf — that is what the role means. Making them open a
        // screen to be granted a right they hold by function is a manual step
        // standing in for a lookup the platform can do itself.
        //
        // The storefront it creates is the workspace's own: named after it,
        // owned by its admin, no payout account. All of it editable in The
        // Thread's settings afterwards.
        const derived = await deriveWorkspaceOrganiser(ctx.workspaceId);
        if ('error' in derived) return c.json({ error: derived.error }, 400);
        organiser = derived.organiser;
      }
    }

    const { data: threadApp } = await adminClient
      .from('app')
      .select('id')
      .eq('slug', 'the-thread')
      .maybeSingle();
    if (!threadApp) return c.json({ error: 'the-thread app row missing' }, 500);

    // app_id says the programme belongs to The Thread — it does, that is where
    // it is administered. source_app says who created it. Different questions.
    const { data: program, error: pErr } = await adminClient
      .from('program')
      .insert({
        workspace_id: ctx.workspaceId,
        app_id: threadApp.id,
        title: b.title,
        format: b.format,
        starts_on: b.starts_on ?? null,
        ends_on: b.ends_on ?? null,
        source_app: ctx.appId,
        source_ref: b.source_ref ?? null,
      })
      .select('id')
      .single();
    if (pErr || !program) {
      console.error('[app-thread] program insert failed', pErr);
      return c.json({ error: pErr?.message ?? 'program insert failed' }, 500);
    }

    const { data: thread, error: tErr } = await adminClient
      .from('thread_thread')
      .insert({
        workspace_id: ctx.workspaceId,
        program_id: program.id,
        organiser_id: organiser.id,
        slug: b.slug,
        intention: b.intention ?? null,
        timezone: b.timezone ?? 'Europe/Amsterdam',
      })
      .select('id')
      .single();
    if (tErr || !thread) {
      console.error('[app-thread] thread insert failed', tErr);
      // Don't strand the programme — a retry would then hit the idempotency
      // index and find a programme with no page behind it.
      await adminClient.from('program').delete().eq('id', program.id);
      const conflict = tErr?.code === '23505';
      return c.json(
        { error: conflict ? `slug "${b.slug}" is already taken for that organiser` : tErr?.message ?? 'thread insert failed' },
        conflict ? 409 : 500,
      );
    }

    const full = await ownThread(ctx, thread.id);
    return c.json({ ...(full ? shapeThread(full) : { id: thread.id }), created: true }, 201);
  });

  // -------------------------------------------------------------------------
  // GET /apps/:slug/thread/threads — the threads this app published.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/thread/threads', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    const { data: programs } = await adminClient
      .from('program')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('source_app', ctx.appId);
    const ids = (programs ?? []).map((p) => p.id as string);
    if (!ids.length) return c.json({ threads: [] });

    const { data, error } = await adminClient
      .from('thread_thread')
      .select(
        'id, workspace_id, program_id, organiser_id, slug, intention, timezone, language, cover_url, is_public_listed, requires_approval, public_interaction, share_participants_public, share_participants_participants, price_cents, price_currency, capacity, created_at, updated_at, program:program_id (id, title, format, status, starts_on, ends_on, source_app, source_ref), organiser:organiser_id (id, slug, display_name)',
      )
      .in('program_id', ids)
      .order('created_at', { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ threads: (data ?? []).map(shapeThread) });
  });

  // -------------------------------------------------------------------------
  // GET /apps/:slug/thread/threads/:id — read one back.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/thread/threads/:id', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const thread = await ownThread(ctx, c.req.param('id'));
    if (!thread) return c.json({ error: 'thread not found' }, 404);
    return c.json(shapeThread(thread));
  });

  // -------------------------------------------------------------------------
  // PATCH /apps/:slug/thread/threads/:id — edit as the plan firms up.
  //
  // Note what is absent: price, payment destination, certificates, tickets and
  // registration fields. Those are money and credentials, and they belong to a
  // human in The Thread's own UI, not to a planning tool holding an API key.
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // POST /apps/:slug/thread/threads/:id/hosts — credit someone who helps run it.
  //
  // §1 of docs/brief-thread-event-settings.md. Hosts & Facilitators is
  // thread_thread_organiser, which pointed only at thread_organiser — a
  // storefront, needing a Fibre user. A festival's hosts sign in to the app's
  // own database and never will have one, so they could not be listed at all.
  //
  // The list now takes a person directly (20260828120000). One list, not two.
  //
  // The person is named by the app's OWN record id, already linked through
  // /links — the same reasoning as /memberships and Flow steps by key. The app
  // never handles a platform UUID.
  // -------------------------------------------------------------------------
  const AddHost = z.object({
    person: z.object({
      app_entity: z.string().min(1).max(100),
      app_record_id: z.string().min(1).max(200),
    }),
    /** Matches the column's check constraint, widened from co_organiser in
     *  20260702110000. The brief still says co_organiser; the column does not. */
    role: z.enum(['host', 'facilitator']).optional(),
  });

  appsRoutes.post('/:slug/thread/threads/:id/hosts', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    const body = AddHost.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const b = body.data;

    const thread = await ownThread(ctx, c.req.param('id'));
    if (!thread) return c.json({ error: 'thread not found' }, 404);

    const { data: app } = await adminClient
      .from('app')
      .select('id')
      .eq('slug', ctx.appId)
      .maybeSingle();
    if (!app) return c.json({ error: 'unknown app' }, 404);

    const { data: link } = await adminClient
      .from('app_record_link')
      .select('platform_entity, platform_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('app_id', app.id)
      .eq('app_entity', b.person.app_entity)
      .eq('app_record_id', b.person.app_record_id)
      .maybeSingle();
    if (!link || link.platform_entity !== 'person') {
      return c.json(
        { error: `no person linked as ${b.person.app_entity}/${b.person.app_record_id}` },
        404,
      );
    }

    // Idempotent on (thread_id, person_id): a repeat call updates the role
    // rather than failing on the unique constraint or adding a second row.
    const { data: host, error } = await adminClient
      .from('thread_thread_organiser')
      .upsert(
        {
          thread_id: thread.id,
          person_id: link.platform_id,
          organiser_id: null,
          role: b.role ?? 'host',
        },
        { onConflict: 'thread_id,person_id' },
      )
      .select('id, role, person_id')
      .single();
    if (error) {
      console.error('[app-thread] add host failed', error);
      return c.json({ error: 'could not add that host' }, 500);
    }

    return c.json({ id: host.id, person_id: host.person_id, role: host.role }, 201);
  });

  appsRoutes.patch('/:slug/thread/threads/:id', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    const body = PatchThread.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const thread = await ownThread(ctx, c.req.param('id'));
    if (!thread) return c.json({ error: 'thread not found' }, 404);

    const b = body.data;
    // Split the patch: some fields live on the programme, some on the page.
    const programPatch: Record<string, unknown> = {};
    if (b.title !== undefined) programPatch.title = b.title;
    if (b.starts_on !== undefined) programPatch.starts_on = b.starts_on;
    if (b.ends_on !== undefined) programPatch.ends_on = b.ends_on;
    if (b.status !== undefined) programPatch.status = b.status;

    const threadPatch: Record<string, unknown> = {};
    if (b.intention !== undefined) threadPatch.intention = b.intention;
    if (b.cover_url !== undefined) threadPatch.cover_url = b.cover_url;
    if (b.is_public_listed !== undefined) threadPatch.is_public_listed = b.is_public_listed;
    if (b.capacity !== undefined) threadPatch.capacity = b.capacity;
    if (b.timezone !== undefined) threadPatch.timezone = b.timezone;
    if (b.language !== undefined) threadPatch.language = b.language;
    if (b.requires_approval !== undefined) threadPatch.requires_approval = b.requires_approval;
    if (b.public_interaction !== undefined) threadPatch.public_interaction = b.public_interaction;
    if (b.share_participants_public !== undefined) {
      threadPatch.share_participants_public = b.share_participants_public;
    }
    if (b.share_participants_participants !== undefined) {
      threadPatch.share_participants_participants = b.share_participants_participants;
    }
    if (b.price_cents !== undefined) threadPatch.price_cents = b.price_cents;
    if (b.price_currency !== undefined) threadPatch.price_currency = b.price_currency;

    const program = one(thread.program) as { id: string; starts_on: string | null; ends_on: string | null } | null;
    const startsOn = (b.starts_on !== undefined ? b.starts_on : program?.starts_on) ?? null;
    const endsOn = (b.ends_on !== undefined ? b.ends_on : program?.ends_on) ?? null;
    if (startsOn && endsOn && endsOn < startsOn) {
      return c.json({ error: 'the end date cannot be before the start date' }, 400);
    }

    if (Object.keys(programPatch).length && program) {
      const { error } = await adminClient.from('program').update(programPatch).eq('id', program.id);
      if (error) {
        console.error('[app-thread] program patch failed', error);
        return c.json({ error: error.message }, 500);
      }
    }
    if (Object.keys(threadPatch).length) {
      threadPatch.updated_at = new Date().toISOString();
      const { error } = await adminClient
        .from('thread_thread')
        .update(threadPatch)
        .eq('id', thread.id);
      if (error) {
        console.error('[app-thread] thread patch failed', error);
        return c.json({ error: error.message }, 500);
      }
    }

    const fresh = await ownThread(ctx, thread.id);
    return c.json(fresh ? shapeThread(fresh) : { id: thread.id });
  });

  // -------------------------------------------------------------------------
  // GET /apps/:slug/thread/threads/:id/enrolments — who registered.
  //
  // A registration is a PLATFORM row (`enrolment`) with The Thread's commerce
  // and form answers layered on top (`thread_enrolment`). This reads the
  // platform row through a Thread-shaped lens; it does not reach into another
  // app's private data. What it must never carry is in THE WALL at the top.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/thread/threads/:id/enrolments', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    const thread = await ownThread(ctx, c.req.param('id'));
    if (!thread) return c.json({ error: 'thread not found' }, 404);
    const program = one(thread.program) as { id: string } | null;
    if (!program) return c.json({ error: 'thread has no programme' }, 500);

    // Named columns, never select('*') — see THE WALL.
    const { data: te, error } = await adminClient
      .from('thread_enrolment')
      .select(ENROLMENT_SELECT)
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[app-thread] enrolments read failed', error);
      return c.json({ error: error.message }, 500);
    }

    const rows = te ?? [];
    const enrolmentIds = rows.map((r) => r.enrolment_id as string);
    const personIds = [...new Set(rows.map((r) => r.person_id as string))];

    const [{ data: enrolments }, { data: people }] = await Promise.all([
      enrolmentIds.length
        ? adminClient
            .from('enrolment')
            .select('id, status, progress_pct, enrolled_at, completed_at')
            .in('id', enrolmentIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      personIds.length
        ? adminClient
            .from('person')
            .select('id, first_name, last_name, email')
            .in('id', personIds)
            .eq('workspace_id', ctx.workspaceId)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    const enrolmentById = new Map((enrolments ?? []).map((e) => [e.id as string, e]));
    const personById = new Map((people ?? []).map((p) => [p.id as string, p]));

    return c.json({
      thread_id: thread.id,
      enrolments: rows.map((r) => {
        const e = enrolmentById.get(r.enrolment_id as string) as Record<string, any> | undefined;
        const p = personById.get(r.person_id as string) as Record<string, any> | undefined;
        return {
          id: r.id,
          enrolment_id: r.enrolment_id,
          person_id: r.person_id,
          full_name: p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || null : null,
          email: p?.email ?? null,
          // The platform's enrolment state — the registration itself.
          status: e?.status ?? null,
          progress_pct: e?.progress_pct ?? null,
          enrolled_at: e?.enrolled_at ?? null,
          completed_at: e?.completed_at ?? null,
          // A state, not an instrument. Amounts, coupons and Stripe ids stay
          // behind the wall.
          payment_status: r.payment_status,
          registered_at: r.created_at,
        };
      }),
    });
  });
}
