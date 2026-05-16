// Cross-app entity mapping endpoints. Apps use these to:
//   * link their own records to platform persons/orgs/users
//   * look up a platform entity by their (app_record_id)
//   * declare/update the entity mappings in their manifest
//
// See docs/cross-app-entity-mapping.md and docs/fibre-vs-app-data.md for the
// contract these implement.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';

export const appsRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/v1/apps/:slug/links — link an app record to a platform entity.
//
// Behaviour:
//   1. Look up an existing platform entity by `match_on` (e.g. email → person).
//   2. If found, record the link and return {platform_id, action:'linked'}.
//   3. If not found, optionally create the platform entity from the supplied
//      payload, then link. Returns {action:'created'}.
// ---------------------------------------------------------------------------

const LinkBody = z.object({
  app_entity: z.string().min(1).max(100),
  app_record_id: z.string().min(1).max(255),
  // Fields the app supplies to find / create the platform entity by.
  // Email is the primary key for persons; domain for orgs (later).
  match_on: z.object({
    email: z.string().email().toLowerCase().optional(),
    name: z.string().max(200).optional(),
  }),
  // If create_if_missing=true and no entity matched, create one.
  create_if_missing: z.boolean().optional(),
});

appsRoutes.post('/:slug/links', async (c) => {
  const slug = c.req.param('slug');
  const body = LinkBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  // Resolve the app + the mapping for (workspace, app, app_entity).
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { data: mapping } = await adminClient
    .from('app_entity_mapping')
    .select('platform_entity, mapping_kind, match_on')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id)
    .eq('app_entity', body.data.app_entity)
    .maybeSingle();
  if (!mapping) {
    return c.json(
      { error: `no entity mapping declared for ${slug}/${body.data.app_entity}` },
      400,
    );
  }
  if (mapping.platform_entity !== 'person') {
    return c.json(
      { error: `only person mappings supported in this endpoint today` },
      400,
    );
  }

  const email = body.data.match_on.email;
  if (!email) {
    return c.json({ error: 'match_on.email is required for person mappings' }, 400);
  }

  // 1) find existing person
  let { data: person } = await adminClient
    .from('person')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();

  let action: 'linked' | 'created' = 'linked';
  if (!person) {
    if (!body.data.create_if_missing) {
      return c.json({ error: 'no matching person; pass create_if_missing=true to make one' }, 404);
    }
    const parts = (body.data.match_on.name ?? '').trim().split(/\s+/);
    const firstName = parts[0] ?? null;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
    const { data: created, error } = await adminClient
      .from('person')
      .insert({
        workspace_id: ctx.workspaceId,
        email,
        first_name: firstName,
        last_name: lastName,
      })
      .select('id')
      .single();
    if (error || !created) {
      console.error('[apps/links] person create failed', error);
      return c.json({ error: error?.message ?? 'create failed' }, 500);
    }
    person = created;
    action = 'created';
  }

  // 2) upsert the link row
  const { error: linkErr } = await adminClient
    .from('app_record_link')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        app_id: app.id,
        app_entity: body.data.app_entity,
        app_record_id: body.data.app_record_id,
        platform_entity: 'person',
        platform_id: person.id,
        linked_by: ctx.userId,
      },
      { onConflict: 'workspace_id,app_id,app_entity,app_record_id' },
    );
  if (linkErr) {
    console.error('[apps/links] link insert failed', linkErr);
    return c.json({ error: linkErr.message }, 500);
  }

  return c.json({ platform_id: person.id, platform_entity: 'person', action }, 201);
});

// ---------------------------------------------------------------------------
// GET /api/v1/apps/:slug/links/:app_entity/:app_record_id — reverse lookup.
// Returns the platform entity an app record is linked to.
// ---------------------------------------------------------------------------
appsRoutes.get('/:slug/links/:app_entity/:app_record_id', async (c) => {
  const slug = c.req.param('slug');
  const appEntity = c.req.param('app_entity');
  const appRecordId = c.req.param('app_record_id');
  const ctx = c.get('ctx');

  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { data: link } = await adminClient
    .from('app_record_link')
    .select('platform_entity, platform_id, linked_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id)
    .eq('app_entity', appEntity)
    .eq('app_record_id', appRecordId)
    .maybeSingle();
  if (!link) return c.json({ error: 'no link found' }, 404);
  return c.json(link);
});

// ---------------------------------------------------------------------------
// GET /api/v1/apps/:slug/manifest — declared entity mappings for this app
// in the current workspace. Useful for admins reviewing what's installed.
// ---------------------------------------------------------------------------
appsRoutes.get('/:slug/manifest', async (c) => {
  const slug = c.req.param('slug');
  const ctx = c.get('ctx');

  const { data: app } = await adminClient
    .from('app')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { data: mappings } = await adminClient
    .from('app_entity_mapping')
    .select('app_entity, platform_entity, mapping_kind, match_on, registered_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id)
    .order('app_entity', { ascending: true });

  return c.json({ app, mappings: mappings ?? [] });
});

// ---------------------------------------------------------------------------
// GET /api/v1/apps/:slug/persons/:app_entity/:app_record_id
// Returns the full person row matching the app link. Convenience over the
// reverse-lookup endpoint + a separate person fetch.
// ---------------------------------------------------------------------------
appsRoutes.get('/:slug/persons/:app_entity/:app_record_id', async (c) => {
  const slug = c.req.param('slug');
  const appEntity = c.req.param('app_entity');
  const appRecordId = c.req.param('app_record_id');
  const ctx = c.get('ctx');

  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { data: link } = await adminClient
    .from('app_record_link')
    .select('platform_entity, platform_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id)
    .eq('app_entity', appEntity)
    .eq('app_record_id', appRecordId)
    .maybeSingle();
  if (!link || link.platform_entity !== 'person') {
    return c.json({ error: 'no person link' }, 404);
  }
  const { data: person } = await adminClient
    .from('person')
    .select('*')
    .eq('id', link.platform_id)
    .single();
  return c.json(person);
});
