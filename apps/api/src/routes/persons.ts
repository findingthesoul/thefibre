import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

export const personsRoutes = new Hono();

const ListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
});

personsRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let query = db
    .from('person')
    .select('id, first_name, last_name, email, country, created_at')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(limit + 1);

  if (after) query = query.gt('id', after);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({
    items,
    next: hasMore ? items[items.length - 1]?.id : null,
  });
});

const PersonCreate = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  preferred_name: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
});

personsRoutes.post('/', async (c) => {
  const body = PersonCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('person')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id, first_name, last_name, email, country, created_at')
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // ---------------------------------------------------------------------
  // Verified-domain auto-attribution.
  //
  // If the new person's email domain matches a *verified* organisation
  // in this workspace, snap them to that org with an org_membership
  // row. Verified = domain_verified_at IS NOT NULL — i.e. someone
  // proved ownership of the domain via DNS challenge (v0.13.14).
  //
  // Why this is safe:
  //  - The org owner had to actively verify the domain via TXT record.
  //    Unverified domains are ignored, so a typoed/squatted org domain
  //    can't auto-attribute strangers.
  //  - Brand-new person → no existing primary org → we can mark this
  //    new membership as primary without conflict.
  //  - An activity row makes the auto-link auditable; the user can
  //    end the membership manually if it's wrong.
  //
  // Non-fatal: any failure here is logged and swallowed; the person
  // create itself stays successful.
  // ---------------------------------------------------------------------
  let autoLinkedOrgId: string | null = null;
  let autoLinkedOrgName: string | null = null;
  try {
    const at = (data.email ?? '').lastIndexOf('@');
    const domain = at >= 0 ? data.email!.slice(at + 1).toLowerCase().trim() : '';
    if (domain) {
      const { data: org } = await db
        .from('organisation')
        .select('id, name')
        .eq('workspace_id', ctx.workspaceId)
        .ilike('domain', domain)
        .not('domain_verified_at', 'is', null)
        .is('deleted_at', null)
        .maybeSingle();
      if (org) {
        const { error: memErr } = await db
          .from('org_membership')
          .insert({
            person_id: data.id,
            org_id: org.id,
            is_primary: true,
            started_at: new Date().toISOString().slice(0, 10),
          });
        if (memErr) {
          console.warn('[person-create auto-link] insert failed', memErr);
        } else {
          autoLinkedOrgId = org.id;
          autoLinkedOrgName = org.name;
        }
      }
    }
  } catch (e) {
    console.warn('[person-create auto-link] error', (e as Error).message);
  }

  // Write a platform activity event. Non-fatal if it fails. When
  // auto-attribution happened, the subject line says so — useful when
  // auditing where a contact's org link came from.
  const { data: platformApp } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  if (platformApp) {
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email;
    const subject = autoLinkedOrgName
      ? `Added ${name} to the workspace · auto-linked to ${autoLinkedOrgName} (verified domain)`
      : `Added ${name} to the workspace`;
    await db.from('activity').insert({
      workspace_id: ctx.workspaceId,
      person_id: data.id,
      app_id: platformApp.id,
      type: 'user_created',
      subject,
      created_by: ctx.userId,
    });
  }

  return c.json(
    { ...data, auto_linked_org_id: autoLinkedOrgId },
    201,
  );
});

personsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('person')
    .select('*')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

// GET /api/v1/persons/:id/memberships
// Platform-owned "where does this person belong" view:
//   - org_memberships  (which organisations + title/role/seniority)
//   - workspace_member (their role in this workspace, if they have a user
//     account here)
//   - app_memberships  (which apps they hold a seat for — empty for
//     non-user contacts)
// All visible to any workspace member; orgs + workspaces are platform-level
// contact-graph edges per brief §2 ("platform owns the edges").
personsRoutes.get('/:id/memberships', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  // Person + user_id linkage (a user record represents the same human when
  // they hold a Fibre account — meet_host, app_memberships etc. all live
  // under user.id, not person.id).
  const { data: person, error: pErr } = await db
    .from('person')
    .select('id, user_id, email')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) return c.json({ error: 'person not found' }, 404);

  // Current + historical org memberships.
  const { data: orgRows } = await db
    .from('org_membership')
    .select(
      'id, title, department, seniority_level, employment_type, is_primary, is_decision_maker, is_budget_holder, is_champion, started_at, ended_at, organisation:org_id (id, name, slug, domain)',
    )
    .eq('person_id', personId)
    .order('is_primary', { ascending: false })
    .order('started_at', { ascending: false, nullsFirst: false });

  let workspaceMember:
    | {
        workspace_id: string;
        workspace_role: 'admin' | 'member';
        relationship_type: 'internal' | 'external';
        joined_at: string;
        workspace: { id: string; name: string; slug: string } | null;
      }
    | null = null;
  let appMemberships: { app: { slug: string; name: string }; role: string }[] = [];

  if (person.user_id) {
    const { data: wm } = await db
      .from('workspace_member')
      .select(
        'workspace_id, workspace_role, relationship_type, joined_at, workspace:workspace_id (id, name, slug)',
      )
      .eq('user_id', person.user_id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (wm) {
      const ws = Array.isArray(wm.workspace) ? wm.workspace[0] : wm.workspace;
      workspaceMember = {
        workspace_id: wm.workspace_id,
        workspace_role: wm.workspace_role,
        relationship_type: wm.relationship_type,
        joined_at: wm.joined_at,
        workspace: ws ?? null,
      };
    }
    // Only list apps the workspace has activated (workspace_app row with
    // deactivated_at IS NULL). A leftover app_membership from before an
    // app was deactivated is not "access" today — it's dormant. Without
    // this filter the profile contradicts /settings/apps.
    const { data: activeApps } = await db
      .from('workspace_app')
      .select('app_id')
      .eq('workspace_id', ctx.workspaceId)
      .is('deactivated_at', null);
    const activeAppIds = new Set((activeApps ?? []).map((r) => r.app_id as string));

    const { data: ams } = await db
      .from('app_membership')
      .select('app_id, role, app:app_id (slug, name)')
      .eq('user_id', person.user_id);
    appMemberships = (ams ?? [])
      .filter((r) => {
        // fibre-platform is The Fibre itself — always present, even though
        // there's no workspace_app row for it (matches /api/v1/auth/me).
        const appRow = Array.isArray(r.app) ? r.app[0] : r.app;
        if (appRow?.slug === 'fibre-platform') return true;
        return activeAppIds.has(r.app_id as string);
      })
      .map((r) => ({
        app: Array.isArray(r.app) ? r.app[0]! : r.app!,
        role: r.role,
      }));
  }

  return c.json({
    org_memberships: orgRows ?? [],
    workspace_member: workspaceMember,
    app_memberships: appMemberships,
    has_account: !!person.user_id,
  });
});

const PersonUpdate = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  preferred_name: z.string().max(100).nullable().optional(),
  pronouns: z.string().max(50).nullable().optional(),
  email: z.string().email().optional(),
  email_secondary: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  // Accept any string; display layer prepends https:// if needed.
  linkedin_url: z.string().max(500).nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  preferred_language: z.string().max(10).nullable().optional(),
});

personsRoutes.patch('/:id', async (c) => {
  const body = PersonUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('person')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

personsRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Soft delete only — brief §13.3.
  const { error } = await db
    .from('person')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .is('deleted_at', null);

  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ============================================================================
// Profile sub-resources — one row per person each.
// All four use the same upsert-on-PATCH pattern: if no row exists, create one;
// otherwise update. GET returns the row or null.
// ============================================================================

async function upsertProfile<T extends Record<string, unknown>>(
  c: import('hono').Context,
  table: string,
  appSlug: 'fibre-platform' | 'fibre-meet' | 'the-thread' | 'fibre-sales' | 'fibre-learn',
  body: T,
) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  // Confirm the person exists in this workspace.
  const { data: person, error: pErr } = await db
    .from('person')
    .select('id')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) {
    console.error('[upsertProfile] person not found', { table, personId, pErr });
    return c.json({ error: 'person not found' }, 404);
  }

  // Resolve the owning app's uuid. Required since v0.4 — the row must declare
  // who owns it. RLS checks the user has membership for that app.
  const { data: app, error: aErr } = await db
    .from('app')
    .select('id')
    .eq('slug', appSlug)
    .single();
  if (aErr || !app) {
    console.error('[upsertProfile] app not found', { table, appSlug, aErr });
    return c.json({ error: `app not found: ${appSlug}` }, 500);
  }

  const { data, error } = await db
    .from(table)
    .upsert({ person_id: personId, app_id: app.id, ...body }, { onConflict: 'person_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[upsertProfile] upsert failed', { table, personId, appSlug, body, error });
    return c.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, 500);
  }
  return c.json(data);
}

async function getProfile(c: import('hono').Context, table: string) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('person_id', c.req.param('id'))
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? null);
}

// --- person_professional ---------------------------------------------------
const SENIORITY = ['junior', 'mid', 'senior', 'lead', 'executive', 'board'] as const;
const CAREER_STAGE = ['early', 'established', 'senior', 'transitioning', 'portfolio'] as const;

const ProfessionalUpdate = z.object({
  current_title: z.string().max(200).nullable().optional(),
  current_department: z.string().max(200).nullable().optional(),
  seniority_level: z.enum(SENIORITY).nullable().optional(),
  sector: z.string().max(200).nullable().optional(),
  expertise_areas: z.array(z.string().max(100)).nullable().optional(),
  industries_worked_in: z.array(z.string().max(100)).nullable().optional(),
  years_of_experience: z.number().int().min(0).max(80).nullable().optional(),
  career_stage: z.enum(CAREER_STAGE).nullable().optional(),
  is_independent: z.boolean().nullable().optional(),
  certifications: z.array(z.string().max(200)).nullable().optional(),
  spoken_at_events: z.array(z.string().max(200)).nullable().optional(),
});

personsRoutes.get('/:id/professional', (c) => getProfile(c, 'person_professional'));
personsRoutes.patch('/:id/professional', async (c) => {
  const body = ProfessionalUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_professional', 'fibre-platform', body.data);
});

// --- person_relationship_context -------------------------------------------
const REL_SOURCE = ['event_attendee', 'referral', 'cold_outreach', 'client_contact', 'inbound'] as const;
const REL_STRENGTH = ['weak', 'warm', 'strong', 'advocate'] as const;
const REL_COMM = ['email', 'phone', 'linkedin', 'in_person'] as const;

const RelationshipUpdate = z.object({
  source: z.enum(REL_SOURCE).nullable().optional(),
  source_detail: z.string().max(500).nullable().optional(),
  introduced_by: z.string().uuid().nullable().optional(),
  relationship_strength: z.enum(REL_STRENGTH).nullable().optional(),
  communication_preference: z.enum(REL_COMM).nullable().optional(),
  best_time_to_reach: z.string().max(200).nullable().optional(),
  is_key_contact: z.boolean().nullable().optional(),
  is_ambassador: z.boolean().nullable().optional(),
  first_contact_notes: z.string().max(2000).nullable().optional(),
  first_contact_at: z.string().datetime().nullable().optional(),
});

personsRoutes.get('/:id/relationship', (c) => getProfile(c, 'person_relationship_context'));
personsRoutes.patch('/:id/relationship', async (c) => {
  const body = RelationshipUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_relationship_context', 'fibre-sales', body.data);
});

// --- person_change_context (facilitator_notes is sensitive — brief §5.D2) --
const CHANGE_ROLE = ['sponsor', 'champion', 'implementer', 'sceptic', 'bystander', 'gatekeeper'] as const;
const CHANGE_STANCE = ['driving', 'supporting', 'ambivalent', 'resistant'] as const;
const READINESS = ['not_ready', 'cautious', 'open', 'ready', 'driving'] as const;

const ChangeUpdate = z.object({
  role_in_change: z.enum(CHANGE_ROLE).nullable().optional(),
  stance_on_change: z.enum(CHANGE_STANCE).nullable().optional(),
  change_themes: z.array(z.string().max(100)).nullable().optional(),
  leadership_style: z.string().max(200).nullable().optional(),
  blockers: z.array(z.string().max(200)).nullable().optional(),
  motivators: z.array(z.string().max(200)).nullable().optional(),
  current_challenge: z.string().max(2000).nullable().optional(),
  facilitator_notes: z.string().max(5000).nullable().optional(),
  readiness_level: z.enum(READINESS).nullable().optional(),
});

personsRoutes.get('/:id/change', (c) => getProfile(c, 'person_change_context'));
personsRoutes.patch('/:id/change', async (c) => {
  const body = ChangeUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  return upsertProfile(c, 'person_change_context', 'fibre-meet', {
    ...body.data,
    notes_updated_at: new Date().toISOString(),
    notes_updated_by: ctx.userId,
  });
});

// --- person_meet_profile — what Meet actually justifies on a person -------
// Replaces the change-facilitation fields on the contact's Fibre Meet tab.
// GET returns the profile + the person's upcoming + past meet_bookings so
// the platform's contact page can show the full Meet picture in one fetch.
const MeetProfileUpdate = z.object({
  host_notes: z.string().max(5000).nullable().optional(),
  vip: z.boolean().optional(),
  blocked: z.boolean().optional(),
  invitee_timezone: z.string().max(100).nullable().optional(),
});

personsRoutes.get('/:id/meet', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  const { data: person, error: pErr } = await db
    .from('person')
    .select('id, email')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) return c.json({ error: 'person not found' }, 404);

  // Profile row — may not exist yet for a new contact.
  const { data: profile } = await db
    .from('person_meet_profile')
    .select('host_notes, vip, blocked, invitee_timezone, updated_at')
    .eq('person_id', personId)
    .maybeSingle();

  // Bookings the person has been an invitee on. Use email to match — that's
  // the join key Meet uses on the booking side (a single canonical contact
  // may have multiple aliased invitee_emails over time; v1 ignores that).
  const nowIso = new Date().toISOString();
  const baseSelect =
    'id, starts_at, ends_at, status, meet_url, alternative_location, meeting_type:meeting_type_id (id, name, slug, host:host_id (slug, user:user_id (full_name)))';
  const { data: upcoming } = await db
    .from('meet_booking')
    .select(baseSelect)
    .eq('invitee_email', person.email ?? '')
    .gte('ends_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(50);
  const { data: past } = await db
    .from('meet_booking')
    .select(baseSelect)
    .eq('invitee_email', person.email ?? '')
    .lt('ends_at', nowIso)
    .order('starts_at', { ascending: false })
    .limit(50);

  return c.json({
    profile: profile ?? null,
    upcoming_bookings: upcoming ?? [],
    past_bookings: past ?? [],
  });
});

personsRoutes.patch('/:id/meet', async (c) => {
  const body = MeetProfileUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  const { data: person, error: pErr } = await db
    .from('person')
    .select('id, workspace_id')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) return c.json({ error: 'person not found' }, 404);

  const { data: app, error: aErr } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-meet')
    .single();
  if (aErr || !app) return c.json({ error: 'fibre-meet app not found' }, 500);

  const { data, error } = await db
    .from('person_meet_profile')
    .upsert(
      {
        workspace_id: person.workspace_id,
        person_id: personId,
        app_id: app.id,
        ...body.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,person_id' },
    )
    .select('*')
    .single();
  if (error) {
    console.error('[persons/meet PATCH] upsert failed', {
      personId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message, code: error.code, details: error.details }, 500);
  }
  return c.json(data);
});

// --- person_learning -------------------------------------------------------
const LEARNING_STYLE = ['visual', 'auditory', 'reading', 'kinaesthetic', 'reflective'] as const;
const GROUP_ROLE = ['connector', 'challenger', 'synthesiser', 'anchor', 'observer'] as const;

const LearningUpdate = z.object({
  learning_interests: z.array(z.string().max(100)).nullable().optional(),
  prior_programmes: z.array(z.string().max(200)).nullable().optional(),
  learning_style: z.enum(LEARNING_STYLE).nullable().optional(),
  group_role_tendency: z.enum(GROUP_ROLE).nullable().optional(),
  development_goals: z.string().max(2000).nullable().optional(),
  post_programme_reflection: z.string().max(5000).nullable().optional(),
  open_to_coaching: z.boolean().nullable().optional(),
  open_to_peer_exchange: z.boolean().nullable().optional(),
});

personsRoutes.get('/:id/learning', (c) => getProfile(c, 'person_learning'));

// --- person_billing (fibre-sales) ------------------------------------------
const BillingUpdate = z.object({
  legal_name: z.string().max(200).nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  billing_email: z.string().email().nullable().optional(),
  billing_street: z.string().max(200).nullable().optional(),
  billing_postal_code: z.string().max(20).nullable().optional(),
  billing_city: z.string().max(100).nullable().optional(),
  billing_region: z.string().max(100).nullable().optional(),
  billing_country: z.string().length(2).nullable().optional(),
  payment_terms_days: z.number().int().min(0).max(365).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  po_required: z.boolean().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

personsRoutes.get('/:id/billing', (c) => getProfile(c, 'person_billing'));
personsRoutes.patch('/:id/billing', async (c) => {
  const body = BillingUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_billing', 'fibre-sales', {
    ...body.data,
    updated_at: new Date().toISOString(),
  });
});

// Apps-discovery: which apps have any data on this person?
// Union of: (a) any curator-profile row exists, (b) any activity event written
// for this person by that app. Returns a list of app slugs in stable order.
personsRoutes.get('/:id/apps', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  // Apps with curator-profile rows (these are RLS-gated, so we'll only see ones
  // the caller has membership for).
  const [profQ, relQ, chgQ, lrnQ, billQ, meetProfQ, actQ] = await Promise.all([
    db.from('person_professional').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_relationship_context').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_change_context').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_learning').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_billing').select('app:app_id (slug)').eq('person_id', personId),
    db.from('person_meet_profile').select('app:app_id (slug)').eq('person_id', personId),
    db.from('activity').select('app:app_id (slug)').eq('person_id', personId),
  ]);

  const slugs = new Set<string>();
  for (const q of [profQ, relQ, chgQ, lrnQ, billQ, meetProfQ, actQ]) {
    for (const row of (q.data ?? []) as unknown as { app: { slug?: string } | { slug?: string }[] | null }[]) {
      const app = Array.isArray(row.app) ? row.app[0] : row.app;
      if (app?.slug) slugs.add(app.slug);
    }
  }

  // Meet also surfaces when the person has been a booking invitee even
  // without curator data. Match on email to mirror the contact-list rule.
  const { data: person } = await db
    .from('person')
    .select('email')
    .eq('id', personId)
    .maybeSingle();
  if (person?.email) {
    const { count } = await db
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('invitee_email', person.email);
    if ((count ?? 0) > 0) slugs.add('fibre-meet');
  }
  return c.json({ apps: Array.from(slugs).sort() });
});
personsRoutes.patch('/:id/learning', async (c) => {
  const body = LearningUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_learning', 'fibre-learn', body.data);
});
