// What this workspace calls the bands.
//
// Sjoerd, 2026-09-12, shown the six lifecycle steps: *"those six steps... not
// sure where they came from. Can they be edited?"* They came from one session
// on 2026-09-11. The answer he chose: the rules stay fixed and derived, the
// NAMES become the workspace's own.
//
// Since 2026-09-13 it also moves the AXIS titles and says which axes a
// workspace shows at all — Sjoerd: *"the whole categorisation should be
// editible. Which charatceristics and how many"*, and *"And the title too"*.
// Same table shape, same rule, one level up (connections_axis_label).
//
// This file only ever moves names and hides axes. There is deliberately no
// endpoint here that says what EARNS a band, or that invents an axis out of a
// rule somebody typed — that lives in connections_landscape and
// connections_landscape_axis, derived from what actually happened, which is
// why the landscape worked on the day it shipped and asks nobody to maintain
// anything. See the migration headers for the full argument.
//
// Hiding an axis does not stop it being computed. The row is untouched and
// the function still answers, so switching one back on shows a complete axis
// rather than one that begins on the day somebody changed their mind.
//
// MOUNT AT `/connections`, next to connectionsRoutes:
//     v1.route('/connections', connectionsLabelsRoutes);
// giving /api/v1/connections/labels.

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';

export const connectionsLabelsRoutes = new Hono();

/**
 * Sparse by design: only bands somebody renamed are stored, and the response
 * carries only those. The web app holds the shipped translations in its typed
 * catalog and falls back to them, so an empty object here is the normal
 * state and not an error.
 */
type LabelRow = { axis: string; band: string; label: string };
type AxisRow = { axis: string; title: string | null; hidden: boolean };

// Read through the service client rather than the user's, because every
// signed-in surface needs these names and the read policy already scopes them
// to the workspace — but the workspace filter is then OURS to apply, not
// RLS's. Explicit, per the app-key rule: never rely on RLS for a filter the
// admin client bypasses.
connectionsLabelsRoutes.get('/labels', async (c) => {
  const ctx = c.get('ctx');
  const [{ data, error }, { data: axisRows, error: axisError }] = await Promise.all([
    adminClient
      .from('connections_band_label')
      .select('axis,band,label')
      .eq('workspace_id', ctx.workspaceId),
    adminClient
      .from('connections_axis_label')
      .select('axis,title,hidden')
      .eq('workspace_id', ctx.workspaceId),
  ]);
  if (error) return c.json({ error: error.message }, 500);
  if (axisError) return c.json({ error: axisError.message }, 500);

  // Nested by axis so a caller can hand one axis's overrides straight to a
  // renderer without filtering. Flat would push that work onto every surface.
  const byAxis: Record<string, Record<string, string>> = {};
  for (const r of (data ?? []) as LabelRow[]) {
    (byAxis[r.axis] ??= {})[r.band] = r.label;
  }

  // Whether THIS user may rename, answered here rather than added to
  // /auth/me. That endpoint is a wide published shape read by eight apps, and
  // this is one screen's question: the settings page needs to know whether to
  // render inputs or a read-only list, and asking the endpoint it is already
  // calling costs nothing. An app-key request has no human and so cannot edit.
  let canEdit = false;
  if (ctx.auth === 'user') {
    const { data: member } = await adminClient
      .from('workspace_member')
      .select('workspace_role')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    canEdit =
      member?.workspace_role === 'admin' || member?.workspace_role === 'super_admin';
  }

  // Sparse in the same way the band labels are: only axes somebody touched
  // have a row, and an absent one means "shipped title, visible". The web app
  // holds the shipped titles in its typed catalog, so `{}` is the normal
  // state for a workspace that has never opened this screen.
  const axes: Record<string, { title: string | null; hidden: boolean }> = {};
  for (const r of (axisRows ?? []) as AxisRow[]) {
    axes[r.axis] = { title: r.title ?? null, hidden: r.hidden };
  }

  return c.json({ labels: byAxis, axes, can_edit: canEdit });
});

const PutAxesBody = z.object({
  axes: z.record(
    z.string().min(1).max(64),
    z.object({
      // Empty means "put the shipped title back", exactly as it does for a
      // band name. Nullable so a caller can change only `hidden` without
      // having to restate a title it does not want to touch.
      title: z.string().max(80).optional(),
      hidden: z.boolean().optional(),
    }),
  ),
});

/**
 * Set titles and visibility for one or more axes.
 *
 * Through the USER's client, so RLS decides — the policy requires admin and
 * re-deriving that here would be a second copy of an authorisation rule.
 *
 * A row is DELETED when it would carry nothing: no title and not hidden. That
 * keeps "never touched" and "reset back to the shipped default" as the same
 * state in the database, which is the property that makes the fallback
 * unambiguous. Storing the shipped English as a title would freeze the axis
 * in English for every other locale.
 *
 * This endpoint cannot create an axis and cannot change what one MEANS. It
 * moves a word and flips a switch.
 */
connectionsLabelsRoutes.put('/axes', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const parsed = PutAxesBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);

  const db = userClient(ctx.jwt);
  const upserts: {
    workspace_id: string;
    axis: string;
    title: string | null;
    hidden: boolean;
    updated_at: string;
    updated_by: string | null;
  }[] = [];
  const clears: string[] = [];

  for (const [axis, want] of Object.entries(parsed.data.axes)) {
    const title = (want.title ?? '').trim();
    const hidden = want.hidden ?? false;
    if (!title && !hidden) {
      clears.push(axis);
    } else {
      upserts.push({
        workspace_id: ctx.workspaceId,
        axis,
        title: title || null,
        hidden,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId || null,
      });
    }
  }

  if (clears.length) {
    const { error } = await db
      .from('connections_axis_label')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .in('axis', clears);
    if (error) return c.json({ error: error.message }, 403);
  }

  if (upserts.length) {
    const { error } = await db
      .from('connections_axis_label')
      .upsert(upserts, { onConflict: 'workspace_id,axis' });
    // RLS refusing a non-admin surfaces as an insert violation rather than a
    // clean 403, so the status is set here.
    if (error) return c.json({ error: error.message }, 403);
  }

  return c.json({ ok: true });
});

const PutBody = z.object({
  axis: z.string().min(1).max(64),
  bands: z.record(
    z.string().min(1).max(64),
    // An empty string is how the interface says "put the shipped name back".
    // Trimmed here rather than in the UI so every caller gets the same rule.
    z.string().max(80),
  ),
});

/**
 * Replace the names for ONE axis.
 *
 * Writes go through the USER's client so RLS decides whether they are
 * allowed — the policy requires admin, and re-deriving that check here would
 * be a second copy of an authorisation rule that can drift from the first.
 * A non-admin gets zero rows affected and a 403 below rather than a silent
 * success.
 *
 * An empty or whitespace-only value DELETES the row, which is what "reset to
 * the shipped name" means when absence is the fallback. Storing the shipped
 * English as an override instead would freeze that band in English for every
 * other locale.
 */
connectionsLabelsRoutes.put('/labels', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 401);

  const parsed = PutBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
  const { axis, bands } = parsed.data;

  const db = userClient(ctx.jwt);
  const upserts: {
    workspace_id: string;
    axis: string;
    band: string;
    label: string;
    updated_at: string;
    updated_by: string | null;
  }[] = [];
  const clears: string[] = [];

  for (const [band, raw] of Object.entries(bands)) {
    const label = raw.trim();
    if (label) {
      upserts.push({
        workspace_id: ctx.workspaceId,
        axis,
        band,
        label,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId || null,
      });
    } else {
      clears.push(band);
    }
  }

  if (clears.length) {
    const { error } = await db
      .from('connections_band_label')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('axis', axis)
      .in('band', clears);
    if (error) return c.json({ error: error.message }, 403);
  }

  if (upserts.length) {
    const { error } = await db
      .from('connections_band_label')
      .upsert(upserts, { onConflict: 'workspace_id,axis,band' });
    // RLS refusing a non-admin surfaces as an insert violation, not as a
    // clean 403, so the status is set here rather than passed through.
    if (error) return c.json({ error: error.message }, 403);
  }

  return c.json({ ok: true });
});
