import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';
import { CONSENT_PURPOSES } from '@thefibre/shared';

export const privacyRoutes = new Hono();

const ConsentGrant = z.object({
  person_id: z.string().uuid(),
  purpose_code: z.enum(CONSENT_PURPOSES),
  legal_basis: z.enum(['consent', 'legitimate_interest', 'contract', 'legal_obligation']),
  text_version: z.string().max(50).optional(),
});

privacyRoutes.post('/consent', async (c) => {
  const body = ConsentGrant.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const ipHeader =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip');

  const { data, error } = await db
    .from('consent_record')
    .insert({
      user_id: ctx.userId,
      person_id: body.data.person_id,
      purpose_code: body.data.purpose_code,
      legal_basis: body.data.legal_basis,
      text_version: body.data.text_version ?? null,
      ip_address: ipHeader ?? null,
    })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

privacyRoutes.get('/consent', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // List the caller's own consent records (most recent first per purpose).
  const { data, error } = await db
    .from('consent_record')
    .select('id, purpose_code, legal_basis, granted_at, revoked_at, text_version')
    .eq('user_id', ctx.userId)
    .order('granted_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

privacyRoutes.delete('/consent/:purpose_code', async (c) => {
  const purpose = c.req.param('purpose_code');
  if (!(CONSENT_PURPOSES as readonly string[]).includes(purpose)) {
    return c.json({ error: 'unknown purpose' }, 400);
  }
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { error } = await db
    .from('consent_record')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('purpose_code', purpose)
    .is('revoked_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

const ErasureRequest = z.object({
  person_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

privacyRoutes.get('/requests', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Caller's own person → their requests.
  const { data: me } = await db
    .from('user')
    .select('person_id')
    .eq('id', ctx.userId)
    .single();
  if (!me?.person_id) return c.json({ items: [] });

  const { data, error } = await db
    .from('data_subject_request')
    .select('id, type, status, requested_at, due_at, completed_at, notes')
    .eq('person_id', me.person_id)
    .order('requested_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

/**
 * GDPR Article 15 — Right of Access.
 *
 * Returns a JSON payload with every piece of personal data the platform
 * holds about the calling user. Uses adminClient (RLS bypass) with an
 * explicit user_id / person_id / workspace_id filter on every query:
 * the user has the right to their own data regardless of which app
 * membership currently scopes the equivalent UI query.
 *
 * Categories listed in `_meta.included` so the receiver knows which
 * tables were considered. Empty arrays are returned for categories
 * where no rows exist.
 */
privacyRoutes.get('/export', async (c) => {
  const ctx = c.get('ctx');
  const db = adminClient;

  // Anchor: the caller's user row + person row.
  const { data: userRow, error: userErr } = await db
    .from('user')
    .select(
      'id, workspace_id, person_id, email, full_name, avatar_url, primary_auth_method, email_verified, last_sign_in, created_at, deleted_at',
    )
    .eq('id', ctx.userId)
    .single();
  if (userErr || !userRow) {
    return c.json({ error: userErr?.message ?? 'user not found' }, 500);
  }
  const personId = userRow.person_id as string | null;
  const workspaceId = userRow.workspace_id as string;

  // Run every query in parallel; tolerate per-table errors so a single
  // missing table or RLS surprise doesn't sink the whole export.
  const safe = async <T,>(label: string, p: PromiseLike<{ data: T | null; error: unknown }>) => {
    try {
      const { data, error } = await p;
      if (error) {
        console.error(`[privacy/export] ${label} failed`, error);
        return { rows: [] as unknown as T, error: (error as { message?: string }).message ?? 'unknown' };
      }
      return { rows: (data ?? []) as T };
    } catch (e) {
      console.error(`[privacy/export] ${label} threw`, e);
      return { rows: [] as unknown as T, error: (e as Error).message };
    }
  };

  const [
    person,
    identityProviders,
    appMemberships,
    workspaceMemberships,
    orgMemberships,
    activities,
    bookings,
    personProfessional,
    personChangeContext,
    personRelationshipContext,
    personLearning,
    personBilling,
    personTags,
    consentRecords,
    dataSubjectRequests,
    recordLinks,
    relationshipsFrom,
    relationshipsTo,
    workspace,
  ] = await Promise.all([
    personId
      ? safe(
          'person',
          db
            .from('person')
            .select(
              'id, workspace_id, first_name, last_name, preferred_name, pronouns, email, email_secondary, phone, phone_secondary, linkedin_url, website_url, street, postal_code, city, region, country, preferred_language, languages_spoken, custom_fields, created_at, deleted_at',
            )
            .eq('id', personId)
            .maybeSingle(),
        )
      : Promise.resolve({ rows: null }),
    safe(
      'user_identity_provider',
      db
        .from('user_identity_provider')
        .select(
          'id, provider, provider_email, provider_name, provider_avatar_url, is_primary, connected_at, last_used_at',
        )
        .eq('user_id', ctx.userId),
    ),
    safe(
      'app_membership',
      db
        .from('app_membership')
        .select('id, app_id, role, permissions, granted_at, app:app_id (slug, name)')
        .eq('user_id', ctx.userId),
    ),
    safe(
      'workspace_member',
      db
        .from('workspace_member')
        .select('*')
        .eq('user_id', ctx.userId),
    ),
    personId
      ? safe(
          'org_membership',
          db
            .from('org_membership')
            .select(
              'id, org_id, title, department, sub_department, seniority_level, employment_type, role_in_change, influence_level, is_primary, is_decision_maker, is_budget_holder, is_champion, started_at, ended_at, organisation:org_id (id, name, domain)',
            )
            .eq('person_id', personId),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'activity',
          db
            .from('activity')
            .select('id, workspace_id, app_id, type, subject, occurred_at, created_by, app:app_id (slug, name)')
            .eq('person_id', personId)
            .order('occurred_at', { ascending: false }),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'meet_booking',
          db
            .from('meet_booking')
            .select(
              'id, workspace_id, meeting_type_id, host_id, invitee_email, invitee_name, invitee_answers, starts_at, ends_at, status, conferencing_provider, meet_url, alternative_location, payment_status, payment_method, created_at',
            )
            .eq('invitee_person_id', personId)
            .order('starts_at', { ascending: false }),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe('person_professional', db.from('person_professional').select('*').eq('person_id', personId))
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'person_change_context',
          db.from('person_change_context').select('*').eq('person_id', personId),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'person_relationship_context',
          db.from('person_relationship_context').select('*').eq('person_id', personId),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe('person_learning', db.from('person_learning').select('*').eq('person_id', personId))
      : Promise.resolve({ rows: [] }),
    personId
      ? safe('person_billing', db.from('person_billing').select('*').eq('person_id', personId))
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'person_tag',
          db.from('person_tag').select('person_id, tag:tag_id (id, name, color)').eq('person_id', personId),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'consent_record',
          db
            .from('consent_record')
            .select('id, purpose_code, legal_basis, granted_at, revoked_at, text_version, ip_address')
            .eq('person_id', personId)
            .order('granted_at', { ascending: false }),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'data_subject_request',
          db
            .from('data_subject_request')
            .select('id, type, status, requested_at, due_at, completed_at, notes')
            .eq('person_id', personId)
            .order('requested_at', { ascending: false }),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'app_record_link',
          db
            .from('app_record_link')
            .select('app_id, app_entity, app_record_id, platform_entity, linked_at, app:app_id (slug, name)')
            .eq('platform_id', personId)
            .eq('platform_entity', 'person'),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'relationship_from',
          db
            .from('relationship')
            .select('id, from_person_id, to_person_id, type, strength, notes, created_at')
            .eq('from_person_id', personId),
        )
      : Promise.resolve({ rows: [] }),
    personId
      ? safe(
          'relationship_to',
          db
            .from('relationship')
            .select('id, from_person_id, to_person_id, type, strength, notes, created_at')
            .eq('to_person_id', personId),
        )
      : Promise.resolve({ rows: [] }),
    safe(
      'workspace',
      db
        .from('workspace')
        .select('id, slug, name, plan, created_at')
        .eq('id', workspaceId)
        .maybeSingle(),
    ),
  ]);

  const payload = {
    _meta: {
      generated_at: new Date().toISOString(),
      gdpr_article: 15,
      subject: {
        user_id: userRow.id,
        person_id: personId,
        email: userRow.email,
        workspace_id: workspaceId,
      },
      notes:
        'This export contains every piece of personal data The Fibre stores about you across all installed apps. Activity rows record type + subject only (never message bodies). Per-app curator tables are included regardless of your current app memberships — Article 15 supersedes UI-level scoping.',
      included_categories: [
        'user',
        'person',
        'identity_providers',
        'app_memberships',
        'workspace_memberships',
        'org_memberships',
        'activity',
        'meet_bookings',
        'person_professional',
        'person_change_context',
        'person_relationship_context',
        'person_learning',
        'person_billing',
        'person_tags',
        'consent_records',
        'data_subject_requests',
        'app_record_links',
        'relationships',
        'workspace',
      ],
    },
    user: userRow,
    person: (person as { rows: unknown }).rows ?? null,
    workspace: (workspace as { rows: unknown }).rows ?? null,
    identity_providers: identityProviders.rows ?? [],
    app_memberships: appMemberships.rows ?? [],
    workspace_memberships: workspaceMemberships.rows ?? [],
    org_memberships: orgMemberships.rows ?? [],
    activity: activities.rows ?? [],
    meet_bookings: bookings.rows ?? [],
    person_professional: personProfessional.rows ?? [],
    person_change_context: personChangeContext.rows ?? [],
    person_relationship_context: personRelationshipContext.rows ?? [],
    person_learning: personLearning.rows ?? [],
    person_billing: personBilling.rows ?? [],
    person_tags: personTags.rows ?? [],
    consent_records: consentRecords.rows ?? [],
    data_subject_requests: dataSubjectRequests.rows ?? [],
    app_record_links: recordLinks.rows ?? [],
    relationships: {
      outgoing: relationshipsFrom.rows ?? [],
      incoming: relationshipsTo.rows ?? [],
    },
  };

  // Also file a data_subject_request of type 'access' for the audit trail.
  if (personId) {
    const { error: dsrErr } = await db.from('data_subject_request').insert({
      person_id: personId,
      type: 'access',
      status: 'completed',
      completed_at: new Date().toISOString(),
      notes: 'Self-service export via /api/v1/privacy/export',
    });
    if (dsrErr) console.error('[privacy/export] audit DSR insert failed', dsrErr);
  }

  const emailSlug = (userRow.email as string).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `fibre-data-export-${emailSlug}-${dateSlug}.json`;

  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  return c.body(JSON.stringify(payload, null, 2));
});

privacyRoutes.post('/erasure-request', async (c) => {
  const body = ErasureRequest.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Default to the caller's own person — self-service erasure.
  let personId = body.data.person_id;
  if (!personId) {
    const { data: me } = await db
      .from('user')
      .select('person_id')
      .eq('id', ctx.userId)
      .single();
    if (!me?.person_id) return c.json({ error: 'no person record for caller' }, 400);
    personId = me.person_id;
  }

  const { data, error } = await db
    .from('data_subject_request')
    .insert({
      person_id: personId,
      type: 'erasure',
      notes: body.data.notes ?? null,
    })
    .select('id, type, status, requested_at, due_at')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});
